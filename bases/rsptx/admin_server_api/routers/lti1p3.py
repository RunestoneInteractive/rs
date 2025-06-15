# *************************
# |docname| - LTI1.3 API
# *************************
# This module implements the endpoints for LTI1.3 integration
#
# *     login
# *     launch
# *     register
# *     jwks
# *     dynamic-linking
# *     assign-select
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#

# Standard library
# -------------------
import datetime
import json
import uuid
import os
import tldextract

# Third-party imports
# -------------------
import aiohttp
from aiohttp import ClientResponseError
from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import ValidationError
import jwt

# Local imports
# -------------------
from rsptx.db.models import (
    AuthUserValidator,
    CoursesValidator,
    Lti1p3Conf,
    Lti1p3User,
    Lti1p3Course,
    Lti1p3Assignment,
    AssignmentValidator,
    DomainApprovals,
)
from rsptx.db.crud import (
    check_domain_approval,
    delete_lti1p3_course,
    fetch_assignments,
    fetch_library_book,
    fetch_lti1p3_course_by_rs_course,
    fetch_user,
    create_user,
    create_user_course_entry,
    get_book_subchapters,
    update_assignment,
    update_user,
    get_book_chapters,
    upsert_lti1p3_config,
    user_in_course,
    upsert_lti1p3_user,
    upsert_lti1p3_course,
    upsert_lti1p3_assignment,
    fetch_all_course_attributes,
    fetch_one_assignment,
    create_instructor_course_entry,
    fetch_lti1p3_config_by_lti_data,
    fetch_lti1p3_course_by_lti_id,
    fetch_lti1p3_course_by_id,
    fetch_course,
    fetch_instructor_courses,
    validate_user_credentials
)

from rsptx.configuration import settings
from rsptx.logging import rslogger
from rsptx.auth.session import auth_manager
from rsptx.response_helpers.core import canonical_utcnow
from rsptx.templates import template_folder
from rsptx.endpoint_validators import with_course, instructor_role_required

from rsptx.lti1p3.pylti1p3.lineitem import LineItem
from rsptx.lti1p3.tool_conf_rs import ToolConfRS
from rsptx.lti1p3.caches import RedisCache, SimpleCache
from rsptx.lti1p3.core import (
  update_line_item_from_assignment,
  get_assignment_score_resource_id,
  parse_assignment_score_resource_id
)

from rsptx.lti1p3.pylti1p3.contrib.fastapi import (
    FastAPIOIDCLogin,
    FastAPIMessageLaunch,
    FastAPIRequest,
    FastAPICacheDataStorage,
    FastAPISessionService,
)
from rsptx.lti1p3.pylti1p3.exception import LtiException, LtiServiceException
from rsptx.lti1p3.pylti1p3.deep_link import DeepLinkResource


# Routing
# =======
router = APIRouter(
    prefix="/lti1p3",
    tags=["lti1p3"],
)


def get_tool_config_mgr():
    """
    Get the tool configuration manager that mediates finding LTI configurations
    """
    return ToolConfRS()


def get_launch_data_storage():
    """
    Get the launch data storage mechanism

    pylti1p3 needs to store launch data between sequenced requests
    (e.g. login -> launch) so we need to provide a data storage mechanism

    To develop without Redis, use the following:
    FastAPICacheDataStorage(SimpleCache())
    """
    return FastAPICacheDataStorage(RedisCache())


def get_session_service():
    """
    Get the session service to use for message launches and logins

    pylti1p3 needs a session service. Rather than use the fastapi session
    mechanism, we will leverage the Redis cache for this.
    Again, to develop without redis you could sub in a SimpleCache
    """
    return FastAPISessionService(RedisCache())


async def login_or_create_user(
    launch: FastAPIMessageLaunch,
    lti_course: Lti1p3Course,
    course: CoursesValidator
):
    """
    Helper function for routes that bring an LMS user to Runestone.
    """
    # if LMS provides an email, we want to use that to identify users
    email = check_launch_data(launch, "email", default_value="")
    if email != "":
        user = await fetch_user(email, fallback_to_registration=True)
        user_name = email  # if needed to make a new record
    else:
        # no email, rely on the unique "sub" field provided by the LMS combined with LTI course id to identify users
        sub = check_launch_data(launch, "sub")
        user_name = "anon-" + str(lti_course.id) + "-" + sub
        email = ""
        user = await fetch_user(user_name, fallback_to_registration=False)

    # make sure we found a user
    if not user:
        family_name = check_launch_data(launch, "family_name", default_value="User")
        given_name = check_launch_data(launch, "given_name", default_value="Anon")
        # name = check_launch_data(launch, "name", default_value=f"{given_name} {family_name}")
        user_dict = {
            "username": user_name,
            "first_name": given_name,
            "last_name": family_name,
            "email": email,
            "password": str(uuid.uuid4()),
            "created_on": canonical_utcnow(),
            "modified_on": canonical_utcnow(),
            "registration_key": "",
            "reset_password_key": "",
            "registration_id": email,
            "course_id": course.id,
            "course_name": course.course_name,
            "active": True,
            "donated": False,
            "accept_tcp": True,
        }
        try:
            new_user = AuthUserValidator(**user_dict)
        except ValidationError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Error validating user data '{repr(exc.errors()[0])}'",
            )
        try:
            user = await create_user(new_user)
            rslogger.info(f"LTI1p3 - Created {user.username} ({user.id})")
        except Exception as e:
            HTTPException(status_code=400, detail=f"Error creating user '{e}'")
    else:
        # have user, make sure their course_id/course_name are updated
        await update_user(
            user.id,
            {
                "course_id": course.id,
                "course_name": course.course_name,
            },
        )

    # either way, also make sure we have a lti user record
    lti_user = Lti1p3User(
        lti1p3_course_id=lti_course.id,
        rs_user_id=user.id,
        lti_user_id=check_launch_data(launch, "sub"),
    )
    await upsert_lti1p3_user(lti_user)
    lti_user.rs_user = user

    # and make sure they are an instructor if appropriate
    if launch.check_teacher_access():
        await create_instructor_course_entry(user.id, course.id)
        rslogger.info(
            f"LTI1p3 - Marked {user.username} ({user.id}) as instructor in {course.id}"
        )

    # finally, make sure that w2p server knows they are logged in
    to_encode = dict(registration_id=user.registration_id)
    jwt_secret = settings.jwt_secret
    encoded_jwt = jwt.encode(to_encode, jwt_secret, "HS256")
    # Assuming we are running in docker, we need to connect out to the machine
    # that is running the container. If we try to use localhost, runestone,
    # or the domain name, they will resolve to an internal IP that makes sense on
    # the host, not the container.
    domain = get_domain()
    url = f"https://{domain}/default/w2py_login?token={encoded_jwt}"
    async with aiohttp.ClientSession() as session:
        try:
            resp = await session.get(url)
            resp.raise_for_status()
        except Exception as e:
            rslogger.error(f"LTI1p3 - Error logging in to w2p server: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error logging in to w2p server '{e}'",
            )

    return lti_user


def check_launch_data(
    launch: FastAPIMessageLaunch, key: str, default_value: str = None
):
    """
    Get a key from the launch data, raise an error if it is missing and there is no default_value
    """
    value = launch.get_launch_data().get(key)
    if value is not None:
        return value
    if default_value is not None:
        return default_value
    raise HTTPException(status_code=400, detail=f"Missing '{key}' in launch data")


@router.get("/login")
@router.post("/login")
async def login(request: Request):
    """
    OIDC login endpoint for LTI 1.3
    """
    rslogger.debug("LTI1p3 - login")
    tool_conf = get_tool_config_mgr()

    fapi_request = await FastAPIRequest.create(request, session=get_session_service())
    target_link_uri = fapi_request.get_param("target_link_uri")

    if not target_link_uri:
        raise HTTPException(status_code=400, detail='Missing "target_link_uri" param')

    oidc_login = FastAPIOIDCLogin(
        fapi_request, tool_conf, launch_data_storage=get_launch_data_storage()
    )

    # if we got any query params, they need to be stripped off
    # and handed to the launch via pass_params_to_launch
    if "?" in target_link_uri:
        target_link_uri, params = target_link_uri.split("?")
        oidc_login.pass_params_to_launch({"query_params": params})

    redirect = await oidc_login.enable_check_cookies().redirect(target_link_uri)

    rslogger.debug(f"LTI1p3 - login redirect {target_link_uri}")
    return redirect


@router.get("/launch")
@router.post("/launch")
async def launch(request: Request):
    rslogger.debug("LTI1p3 - launch ")
    fapi_request = await FastAPIRequest.create(request, session=get_session_service())
    tool_conf = get_tool_config_mgr()
    try:
        message_launch = await FastAPIMessageLaunch.create(
            fapi_request, tool_conf, launch_data_storage=get_launch_data_storage()
        )
    except LtiException as e:
        rslogger.debug("Launch attempt without login. Moodle is known to do this after linking a tool.")
        return JSONResponse(content={"success": False, "error": str(e)})

    # recover any params stashed by /login
    query_params = {}
    launch_params = message_launch.get_params_from_login()
    if launch_params and "query_params" in launch_params:
        query_string = launch_params["query_params"]
        params = query_string.split("&")
        for p in params:
            key, value = p.split("=")
            query_params[key] = value

    # identify the course
    # lti_context_dict = message_launch.get_context()
    lti_course_id = query_params.get("lti_course_id", None)
    lti_course = None
    if lti_course_id:
        lti_course = await fetch_lti1p3_course_by_id(
            int(lti_course_id), with_config=False, with_rs_course=True
        )
    if not lti_course:
        raise HTTPException(
            status_code=400,
            detail="Content does not appeared to be linked to your Learning Management System. Your instructor needs to run the assignment selector tool for Runestone.",
        )
    course = lti_course.rs_course

    # identify and create/login the user
    lti_user = await login_or_create_user(message_launch, lti_course, course)
    rs_user = lti_user.rs_user
    in_course = await user_in_course(rs_user.id, course.id)
    if not in_course:
        await create_user_course_entry(rs_user.id, course.id)
        rslogger.info(
            f"LTI1p3 - enrolled {rs_user.username} ({rs_user.id}) in {course.id}"
        )

    # Different kinds of resourceLinkLaunches get to here and need to be handled differently

    # Type 1: Book links - links to specific pages in the book
    # They will have a query param "book_page"
    if "book_page" in query_params:
        book_page = query_params["book_page"]
        # start redirect to book page
        redirect_to = f"https://{request.url.hostname}/ns/books/published/{course.course_name}/{book_page}"
        response = RedirectResponse(redirect_to, status_code=status.HTTP_303_SEE_OTHER)

    # Type 2: Assignment links - links to Runestone assignments
    # They will have a line item associated with them
    else:
        # Get resourceId of the line item for the resource that was linked
        # should have RSCOURSEID_RSASSIGNMENTID format, use that to load RS assignment and course
        ags = message_launch.get_ags()
        try:
            assign_lineitem = await ags.get_lineitem()
        except LtiServiceException as e:
            raise HTTPException(
                status_code=400,
                detail="Assignment does not appeared to be linked to your Learning Management System. Your instructor needs to run the assignment selector tool for Runestone.",
            )

        assign_resource_id = assign_lineitem.get_resource_id()
        course_id, assign_id = parse_assignment_score_resource_id(assign_resource_id)

        # Verify the line item has been properly linked to this course
        if course_id != course.id:
            raise HTTPException(
                status_code=400,
                detail="Assignment does not appear to be linked to this course. Your instructor needs to run the assignment selector tool for Runestone.",
            )

        rs_assign = await fetch_one_assignment(assign_id)
        if not rs_assign:
            raise HTTPException(
                status_code=400, detail=f"Assignment {assign_id} not found"
            )

        if not rs_assign.visible and not message_launch.check_teacher_access():
            raise HTTPException(
                status_code=400,
                detail=f"Assignment {rs_assign.name} is not open for students",
            )

        # make sure the LTI assignment record is up to date
        await update_lti_assignment_record(assign_lineitem, lti_course, rs_assign)

        # make sure RS assignment is up to date (e.g. end date)
        course_attributes = await fetch_all_course_attributes(course.id)
        await update_rsassignment_from_lti(
            rs_assign, assign_lineitem, course_attributes
        )

        # start redirect to assignment
        # Commented version for running outside of docker
        domain = get_domain()
        redirect_to = f"https://{domain}/assignment/student/doAssignment?assignment_id={rs_assign.id}"
        
        rslogger.debug(f"LTI1p3 - launch redirect {redirect_to}")
        response = RedirectResponse(redirect_to, status_code=status.HTTP_303_SEE_OTHER)

    # At this point should have a valid response object

    # We need to set the cookie here for the redirect in order for
    # the next page to validate. This will also set the cookie in the browser
    # for future pages.
    access_token = auth_manager.create_access_token(
        data={"sub": rs_user.username}, expires=datetime.timedelta(hours=12)
    )
    auth_manager.set_cookie(response, access_token)

    rslogger.debug(f"LTI1p3 - launch sending user to {redirect_to}")
    return response


async def update_lti_assignment_record(
    line_item: LineItem, lti_course: Lti1p3Course, assign: AssignmentValidator
) -> Lti1p3Assignment:
    """
    Update or create a record of the mapping between an LTI assignment and a Runestone assignment.
    The line item for an assignment in the LMS is not available when it is created, so we need to
    update the record when it is launched. This will make sure it is available later for sending
    grade updates back to LMS.
    """
    rs_lti_assign = Lti1p3Assignment(
        lti1p3_course_id=lti_course.id,
        rs_assignment_id=assign.id,
        lti_lineitem_id=line_item.get_id(),
    )
    record = await upsert_lti1p3_assignment(rs_lti_assign)
    record.rs_assignment = assign
    return record


async def update_rsassignment_from_lti(
    assign: AssignmentValidator, line_item: LineItem, course_attributes: dict
) -> AssignmentValidator:
    """
    Update a runestone assignment from LTI data.
    """
    try:
        lms_due_string = line_item.get_end_date_time()
        lms_due = datetime.datetime.fromisoformat(lms_due_string)
        lms_due = lms_due.replace(tzinfo=None)
        if lms_due != None and lms_due != assign.duedate and course_attributes.get("ignore_lti_dates") != 'true':
            assign.duedate = lms_due
            await update_assignment(assign)
    except Exception as e:
        # just ignore bad dates, could be missing, bad format, etc
        pass
    return assign


@router.post("/register")
@router.get("/register")
async def register(
    request: Request,
    openid_configuration: str,
    registration_token: str = "",
    lms: str = None,
):
    rslogger.debug("LTI1p3 - register")
    # ask platform for configuration information
    platform_config = await get_platform_config(openid_configuration)
    rslogger.debug(f"LTI1p3 - registration token: {registration_token}")

    # send platform our registration information
    try:
        registration = await register_with_platform(platform_config, registration_token)
    except ClientResponseError as e:
        rslogger.error(f"LTI1p3 - Error registering with LMS: {e.status} {e.message}")
        return HTMLResponse(
            content=f"Error registering with LMS: {e.status} {e.message}",
            status_code=e.status,
        )

    # confirmed, so store to DB
    platform_extras = platform_config.get("https://purl.imsglobal.org/spec/lti-platform-configuration")
    lti_conf = Lti1p3Conf(
        issuer=platform_config["issuer"],
        client_id=registration["client_id"],
        auth_login_url=platform_config["authorization_endpoint"],
        auth_token_url=platform_config["token_endpoint"],
        key_set_url=platform_config["jwks_uri"],
        product_family_code=platform_extras.get("product_family_code"),
        version=platform_extras.get("version")
    )
    if "authorization_server" in platform_config:
        lti_conf.token_audience = platform_config["authorization_server"]
    else:
        lti_conf.token_audience = platform_config["token_endpoint"]

    await upsert_lti1p3_config(lti_conf)

    templates = Jinja2Templates(directory=template_folder)
    return templates.TemplateResponse(
        "admin/lti1p3/registration_confirm.html",
        request=request, 
        context={
            "message": "LTI 1.3 configuration set",
            "request": request,
        } 
    )


async def get_platform_config(url: str) -> dict:
    """
    Get request to LMS config url to retrieve configuration information
    """
    headers = {"Accept": "application/json"}
    async with aiohttp.ClientSession() as session:
        resp = await session.get(url, headers=headers)
        resp.raise_for_status()
        body = await resp.text()
        return json.loads(body)


def get_domain():
    if "LOAD_BALANCER_HOST" not in os.environ or os.environ["LOAD_BALANCER_HOST"] == "":
        domain = os.environ.get("RUNESTONE_HOST")
    else:
        domain = os.environ["LOAD_BALANCER_HOST"]
    return domain


async def register_with_platform(platform_config: dict, token: str = None) -> dict:
    """
    Register with an LMS platform

    :param platform_config: configuration information retrieved from the platform
    :param token: token for registration provided by the platform
    :return: registration information from the platform
    """
    headers = {"Accept": "application/json", "Content-type": "application/json"}
    if token:
        auth_header = "Bearer " + token
        headers["Authorization"] = auth_header

    client_name = "Runestone"

    domain = get_domain()

    url_base = f"https://{domain}/admin/lti1p3"
    login_url = f"{url_base}/login"
    launch_url = f"{url_base}/launch"
    jwks_url = f"{url_base}/jwks"
    dl_url = f"{url_base}/dynamic-linking"
    redirect_urls = [launch_url, dl_url]
    icon_url = f"https://{domain}/staticAssets/RAIcon.png"
    scopes = " ".join(platform_config.get("scopes_supported"))
    # Support for "$ResourceLink.id.history" is missing in moodle
    # $Context.id.history only works if entire course is copied
    # But let's register to get them... maybe someday they can be relied on
    data = {
        "application_type": "web",
        "response_types": ["id_token"],
        "grant_types": ["implicit", "client_credentials"],
        "initiate_login_uri": login_url,
        "redirect_uris": redirect_urls,
        "client_name": client_name,
        "jwks_uri": jwks_url,
        "token_endpoint_auth_method": "private_key_jwt",
        "id_token_signed_response_alg": "RS256",
        "https://purl.imsglobal.org/spec/lti-tool-configuration": {
            "domain": domain,
            "target_link_uri": launch_url,
            "custom_parameters": {
                "context_id_history": "$Context.id.history",
                "resource_link_history": "$ResourceLink.id.history",
            },
            "claims": [
                "sub",
                "iss",
                "name",
                "given_name",
                "family_name",
                "nickname",
                "email",
            ],
            "messages": [
                {
                    "type": "LtiResourceLinkRequest",
                    "label": "Runestone",
                    "roles": [],
                    "target_link_uri": dl_url,
                },
                {
                    "type": "LtiDeepLinkingRequest",
                    "label": "Runestone",
                    "roles": [],
                    "target_link_uri": dl_url,
                },
            ],
            "description": "Runestone Academy",
        },
        "scope": scopes,
        "logo_uri": icon_url,
    }

    # See if there is any extra configuration to add based on the platform ("canvas", "moodle", etc)
    platform_extras = platform_config.get("https://purl.imsglobal.org/spec/lti-platform-configuration")
    product_family_code = platform_extras.get("product_family_code")

    if product_family_code == "canvas":
        data["https://canvas.instructure.com/lti/privacy_level"] = "public"
        messages = data["https://purl.imsglobal.org/spec/lti-tool-configuration"]["messages"]
        # [0] is ResourceLinkRequest, [1] is DeepLinkingRequest
        messages[0]["https://canvas.instructure.com/lti/display_type"] = "borderless"
        messages[0]["windowTarget"] = "_runestone"
        # Don't need to actually place ResourceLinkRequest anywhere??? We want DeepLinkingRequests
        #messages[0]["placements"] = ["assignment_selection", "link_selection", "course_assignments_menu", "module_index_menu_modal"]
        messages[1]["https://canvas.instructure.com/lti/display_type"] = "borderless"
        messages[1]["windowTarget"] = "_runestone"
        messages[1]["placements"] = ["assignment_selection", "link_selection", "course_assignments_menu", "module_index_menu_modal"]

    async with aiohttp.ClientSession() as session:
        url = platform_config.get("registration_endpoint")
        resp = await session.post(url, headers=headers, json=data)
        body = await resp.text()
        try:
            resp.raise_for_status()
            return json.loads(body)
        except ClientResponseError as e:
            # attach the body to the message as it sometimes has extra info
            e.message = e.message + f" {body}"
            raise e


@router.get("/jwks")
@router.post("/jwks")
async def get_jwks(request: Request):
    tool_conf = get_tool_config_mgr()
    keys = await tool_conf.get_jwks()
    return JSONResponse(keys)


@router.post("/verify-user")
async def deep_link_entry(request: Request):
    """
    Endpoint to verify the user is logged in and has access to the course.
    This is used by the deep linking tool to ensure the user is authenticated.
    """
    data = await request.json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return JSONResponse(content={"success": False, "error": "Username and password are required"})
    
    user = await validate_user_credentials(username, password)
    if not user:
        return JSONResponse(content={"success": False, "error": "Invalid username or password"})

    rslogger.debug(f"LTI1p3 - User {user.__dict__} verified successfully by verify-user")

    user_nonce = "lti1p3-verify-nonce-" + str(uuid.uuid4())
    launch_data_storage = get_launch_data_storage()
    launch_data_storage.set_value(user_nonce, user.username)

    return JSONResponse(content={"success": True, "username": user.username, "nonce": user_nonce})


async def get_authenticated_user(
    request: Request
) -> AuthUserValidator:
    """
    Helper to either get the user from the auth manager or from a nonce.
    If cookies are available, auth_manager will return the user. Otherwise,
    rely on the authentication nonce provided by the rs-login workflow.

    If the nonce is invalid or user is not found, return None.
    """
    user = None
    try:
        user = await auth_manager(request)
        return user
    except Exception as e:
        pass

    # check if we have a form submission with an authentication nonce
    form_data = await request.form()
    authentication_nonce = form_data.get('authentication_nonce') or ""
    launch_data_storage = get_launch_data_storage()
    authorized_username = launch_data_storage.get_value(authentication_nonce)
    if not authorized_username:
        return None
    user = await fetch_user(authorized_username)
    return user


@router.post("/rs-login")
async def deep_link_entry(request: Request):
    tool_conf = get_tool_config_mgr()
    rslogger.info(f"Creating FastAPIRequest with request: {request.__dict__}")
    fapi_request = await FastAPIRequest.create(request, session=get_session_service())
    rslogger.info(f"   Produced fapi_request: {fapi_request.__dict__}")
    message_launch = await FastAPIMessageLaunch.create(
        fapi_request, tool_conf, launch_data_storage=get_launch_data_storage()
    )
    rslogger.debug(f"LTI1p3 - rs-login request: {fapi_request.__dict__}")
    templates = Jinja2Templates(directory=template_folder)
    tpl_kwargs = {
        "request": request,
        "launch_id": message_launch.get_launch_id(),
        "authenticity_token": fapi_request.get_param('authenticity_token'),
        "id_token": fapi_request.get_param('id_token'),
        "state": fapi_request.get_param('state'),
        "lti_storage_target": fapi_request.get_param('lti_storage_target'),
    }
    resp = templates.TemplateResponse(
        name="admin/lti1p3/rs_login.html",
        context=tpl_kwargs
    )
    return resp


@router.get("/dynamic-linking")
@router.post("/dynamic-linking")
async def deep_link_entry(request: Request):
    tool_conf = get_tool_config_mgr()
    fapi_request = await FastAPIRequest.create(request, session=get_session_service())
    message_launch = await FastAPIMessageLaunch.create(
        fapi_request, tool_conf, launch_data_storage=get_launch_data_storage()
    )

    user = await get_authenticated_user(request)
    if not user:
        # Redirect to the rs-login page. It will submit back to this route but with
        # an authentication nonce that will allow us to identify the user.
        resp = RedirectResponse(
            f"/admin/lti1p3/rs-login",
            status_code=307
        )
        return resp

    user_is_instructor = len(await fetch_instructor_courses(user.id, user.course_id)) > 0
    if not user_is_instructor:
        raise HTTPException(
            status_code=403,
            detail="You must be an instructor in your current Runestone course to use this tool. Make sure that you are logged into the correct course in Runestone.",
        )

    course = await fetch_course(user.course_name)

    lti_context = message_launch.get_context()
    # See if currently logged in RS course is already mapped to something else
    lti_course = await fetch_lti1p3_course_by_rs_course(
        course, with_config=False
    )

    issuer = message_launch.get_iss()
    issuer_parsed = tldextract.extract(issuer)
    issuer_domain = f"{issuer_parsed.domain}.{issuer_parsed.suffix}"
    approved = await check_domain_approval(issuer_domain, DomainApprovals.lti1p3)
    if not approved:
        rslogger.debug(
            f"LTI1p3 - Failed domain approval for {course.id}"
        )
        raise HTTPException(
            status_code=403,
            detail=f"The domain reported for this course ({issuer_domain}) is not approved for LTI 1.3 integration. Please make an issue at https://github.com/RunestoneInteractive/rs/issues to request approval.",
        )

    mapping_mismatch = False
    if lti_course and lti_course.lti1p3_course_id != lti_context.get('id'):
        mapping_mismatch = True

    # Gather info for the selection page
    lib_entry = await fetch_library_book(course.base_course)
    if lib_entry.build_system == "Runestone":
        book_system = "Runestone"
    else:
        book_system = "PreTeXt"

    # First get all the chapters/subchapters in the book
    chapters = await get_book_chapters(course.base_course)
    subchapters = await get_book_subchapters(course.base_course)
    # Make a dict of chapter id to empty lists, then fill in the subchapters
    subchapter_dict = {c.id: [] for c in chapters}
    for sub in subchapters:
        subchapter_dict[sub.chapter_id].append(sub)

    # all assignments in Runestone course
    assignments = await fetch_assignments(course.course_name, fetch_all=True)
    assignments.sort(key=lambda a: a.name)
    assignments.sort(key=lambda a: a.duedate)

    # all lineitems in the LMS
    ags = message_launch.get_ags()
    l_items = await ags.get_lineitems()
    l_items.sort(key=lambda li: li.get("label"))

    link_data = message_launch.get_dls()
    supports_multiple = link_data.get("accept_multiple", False)
    if isinstance(supports_multiple, str):
        supports_multiple = supports_multiple.lower() == "true"
    assigns_dicts = []

    # for each assignment in the course, see if it is mapped to the LMS already,
    # or if there is an assignment with matching name
    for a in assignments:
        d = a.__dict__

        lti_name_match = match_by_name(a, l_items)
        if lti_name_match:
            desired_resource_id = get_assignment_score_resource_id(course, a)
            if desired_resource_id == lti_name_match.get("resourceId"):
                d["already_mapped"] = True
                d["mapped_value"] = lti_name_match.get("resourceLinkId")
                d["mapped_name"] = lti_name_match.get("label")
            else:
                d["remap_suggested"] = True
                d["mapped_value"] = lti_name_match.get("resourceLinkId")
                d["mapped_name"] = lti_name_match.get("label")

        assigns_dicts.append(d)

    # if we used an authentication nonce to identify the user, we need to
    # include it in the template context so it can be passed on by pick_links
    form_data = await request.form()
    authentication_nonce = form_data.get('authentication_nonce') or ""

    tpl_kwargs = {
        "launch_id": message_launch.get_launch_id(),
        "assignments": assigns_dicts,
        "lineitems": l_items,
        "supports_multiple": supports_multiple,
        "chapters": chapters,
        "subchapter_dict": subchapter_dict,
        "book_system": book_system,
        "rs_course_name": course.course_name,
        "mapping_mismatch": mapping_mismatch,
        "current_mapped_course_name": lti_context.get("label"),
        "request": request,
        "authentication_nonce": authentication_nonce,
    }

    templates = Jinja2Templates(directory=template_folder)
    resp = templates.TemplateResponse(
        name="admin/lti1p3/pick_links.html",
        context=tpl_kwargs
    )
    return resp


def match_by_name(rs_assign, lti_lineitems):
    """
    Find a line item in the LMS that matches the name of the Runestone assignment
    """
    for l in lti_lineitems:
        if rs_assign.name == l.get("label"):
            return l
    return None


@router.post("/assign-select/{launch_id}")
async def assign_select(launch_id: str, request: Request, course=None):
    rslogger.debug("LTI1p3 - assignment select")
    tool_conf = get_tool_config_mgr()
    fapi_request = await FastAPIRequest.create(request, session=get_session_service())
    launch_data_storage = get_launch_data_storage()

    message_launch = await FastAPIMessageLaunch.from_cache(
        launch_id, fapi_request, tool_conf, launch_data_storage=launch_data_storage
    )
    lti_context_dict = message_launch.get_context()
    lti_course_id = lti_context_dict.get("id")

    if not message_launch.is_deep_link_launch():
        raise HTTPException(status_code=400, detail="Must be a deep link launch!")

    user = await get_authenticated_user(request)
    if not user:
        raise HTTPException(status_code=403, detail="User information not found in request.")

    course = await fetch_course(user.course_name)
    if not course:
        raise HTTPException(
            status_code=404,
            detail=f"Course {user.course_name} not found",
        )

    # Store or update the course to the database
    # This is the first time we have all the necessary information and the instructor
    # has confirmed that they want to create one or more links
    lti_config = await fetch_lti1p3_config_by_lti_data(
        message_launch.get_iss(), message_launch.get_client_id()
    )
    lti_context = message_launch.get_context()
    lti_course = Lti1p3Course(
        rs_course_id=course.id,
        lti1p3_config_id=lti_config.id,
        lti1p3_course_id=lti_course_id,
        course_name=lti_context.get("label"),
        deployment_id=message_launch.get_deployment_id(),
    )

    if message_launch.has_nrps():
        lti_course.name_service_url = message_launch.get_nrps().get_url()
    if message_launch.has_ags():
        lti_course.lineitems_url = message_launch.get_ags().get_lineitems_endpoint()
    lti_course = await upsert_lti1p3_course(lti_course)

    # Make sure we have an LTI mapping for the user. They should already exist and
    # be in the course, but this will make sure we have an LTI1p3User record
    await login_or_create_user(message_launch, lti_course, course)

    # Now start building the response
    domain = get_domain()
    launch_url = f"https://{domain}/admin/lti1p3/launch?lti_course_id={lti_course.id}"
    lib_entry = await fetch_library_book(course.base_course)

    lib_entry = await fetch_library_book(course.base_course)
    if lib_entry.build_system == "Runestone":
        book_system = "Runestone"
    else:
        book_system = "PreTeXt"

    # response list will contain new items for LMS to create
    response_list = []

    # Recreate chapter/subchapter info for processing book links
    chapters = await get_book_chapters(course.base_course)
    chapter_dict = {c.id: c for c in chapters}
    subchapters = await get_book_subchapters(course.base_course)
    # Make a dict of subchapters by their own id
    subchapter_dict = {sc.id: sc for sc in subchapters}

    # count on book links being link_to_X in numeric order from 1
    link_num = 1
    while fapi_request.get_param(f"link_to_{link_num}"):
        selected_value = fapi_request.get_param(f"link_to_{link_num}")
        if selected_value == "index":
            page = "index.html"
            page_name = "Index"
        else:
            type, selected_value = selected_value.split("____")
            if type == "chapter":
                chapter_id = int(selected_value)
                chapter = chapter_dict.get(chapter_id)
                if book_system == "PreTeXt":
                    page = chapter.chapter_label + ".html"
                else:
                    page = chapter.chapter_label + "/toctree.html"
                page_name = f"Chapter {chapter.chapter_num}: {chapter.chapter_name}"
            else:
                subchapter_id = int(selected_value)
                subchapter = subchapter_dict.get(subchapter_id)
                chapter = chapter_dict.get(subchapter.chapter_id)
                if book_system == "PreTeXt":
                    page = subchapter.sub_chapter_label + ".html"
                else:
                    page = chapter.chapter_label + "/" + subchapter.sub_chapter_label + ".html"
                page_name = f"Chapter {chapter.chapter_num}.{subchapter.sub_chapter_num}: {subchapter.sub_chapter_name}"

        dlr = DeepLinkResource()
        dlr.set_url(launch_url + f"&book_page={page}")
        dlr.set_title(f"{lib_entry.title} - {page_name}")
        dlr.set_target("window")

        # add to list of things for LMS to create
        response_list.append(dlr)
        link_num += 1

    # Find assignments to add/update
    # Note: we add Lti1p3Assignments to RS when they are first launched as
    # we won't know ID until LMS creates them

    # Repeat process from deep_link_entry to understand what
    # needs to happen with each selected assignment. First gather all
    # the information we need to make decisions.

    # all assignments in Runestone course mapped by id
    assignments = await fetch_assignments(course.course_name, fetch_all=True)

    # all lineitems in the LMS (potential unmapped assignments)
    # keys for this are strings... make sure to convert id's to strs
    ags = message_launch.get_ags()
    l_items = await ags.get_lineitems()
    l_items_dict = {li.get("resourceLinkId"): li for li in l_items}

    course_attributes = await fetch_all_course_attributes(course.id)
    use_pts = course_attributes.get("show_points", "") == "true"

    for assign in assignments:
        selected_value = fapi_request.get_param(f"assign_{assign.id}")

        if selected_value and selected_value != "":
            if selected_value == "new":
                # Needs to make a link resource and line item on LMS
                dlr = DeepLinkResource()
                dlr.set_url(launch_url)
                dlr.set_title(assign.name)
                dlr.set_target("window")

                line_item = LineItem()
                update_line_item_from_assignment(line_item, assign, course, use_pts)
                dlr.set_lineitem(line_item)

                # add to list of things for LMS to create
                response_list.append(dlr)
            else:
                # linking to an existing lti line item
                # need to send a message to LMS to tag it so we can identify it later
                line_item = l_items_dict.get(selected_value)
                if not line_item:
                    raise HTTPException(
                        status_code=400, detail=f"Line item {selected_value} not found"
                    )
                # convert dict to lti1p3.LineItem
                line_item = LineItem(line_item)
                # update and send to LMS, but don't change due date
                update_line_item_from_assignment(
                    line_item, assign, course, use_pts, push_duedate=False
                )
                await ags.update_lineitem(line_item)
                # update RS due date
                await update_rsassignment_from_lti(
                    assign, line_item, course_attributes
                )
    deep_link = message_launch.get_deep_link()
    response_html = deep_link.output_response_form(response_list)
    return HTMLResponse(content=response_html, status_code=200)


@router.get("/remove-association")
@router.post("/remove-association")
@instructor_role_required()
@with_course()
async def remove_association(request: Request, user=Depends(auth_manager), course=None):
    """
    Accessed from Runestone admin page to remove an association between Runestone and an LMS
    """
    rslogger.debug(f"LTI1p3 - remove_association for {course.id}")

    # FK constraints will take care of any other data
    await delete_lti1p3_course(course.id)

    results = {"status": "success"}
    return JSONResponse(content=results, status_code=200)