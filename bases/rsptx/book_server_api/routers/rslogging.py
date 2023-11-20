# ******************************************************
# |docname| - Provide the ``hsblog`` (kind of) endpoint?
# ******************************************************
# :index:`docs to write`: **Description here...**
#
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import json
from datetime import datetime
import re
from typing import Optional


# Third-party imports
# -------------------
from fastapi import (
    APIRouter,
    Cookie,
    HTTPException,
    Request,
    Response,
    status,
    Depends,
    UploadFile,
)
import boto3
import botocore
from fastapi.responses import JSONResponse

# Local application imports
# -------------------------
from rsptx.logging import rslogger
from rsptx.configuration import settings
from rsptx.db.crud import (
    create_answer_table_entry,
    create_code_entry,
    create_useinfo_entry,
    create_user_chapter_progress_entry,
    create_user_state_entry,
    create_user_sub_chapter_progress_entry,
    EVENT2TABLE,
    fetch_last_page,
    fetch_chapter_for_subchapter,
    fetch_course,
    fetch_course_practice,
    fetch_user_chapter_progress,
    fetch_user_sub_chapter_progress,
    fetch_user,
    is_server_feedback,
    update_sub_chapter_progress,
    update_user_state,
)
from rsptx.response_helpers.core import make_json_response
from rsptx.db.models import (
    AuthUserValidator,
    CodeValidator,
    runestone_component_dict,
    UseinfoValidation,
)
from rsptx.validation.schemas import (
    LastPageData,
    LastPageDataIncoming,
    LogItemIncoming,
    LogRunIncoming,
    TimezoneRequest,
)
from rsptx.auth.session import auth_manager
from rsptx.practice.core import potentially_change_flashcard

# Routing
# =======
# See `APIRouter config` for an explanation of this approach.
router = APIRouter(
    prefix="/logger",
    tags=["logger"],
)

COMMENT_MAP = {
    "sql": "--",
    "python": "#",
    "java": "//",
    "javascript": "//",
    "c": "//",
    "cpp": "//",
}


# .. _log_book_event endpoint:
#
# log_book_event endpoint
# -----------------------
# See :ref:`logBookEvent`.
@router.post("/bookevent")
async def log_book_event(
    entry: LogItemIncoming, request: Request, user=Depends(auth_manager)
):
    """
    This endpoint is called to log information for nearly every click that happens in the textbook.
    It uses the ``LogItemIncoming`` object to define the JSON payload it gets from a page of a book.

    :param entry: The JSON payload from the textbook page.
    :param request: The request object.
    :param user: The user object.
    """
    # if entry.sid is there use that (likely for partner or group work)
    if not entry.sid:
        entry.sid = user.username
    else:
        rslogger.info(f"user {user.username} is submitting work for {entry.sid}")

    # Always use the server's time.
    entry.timestamp = datetime.utcnow()
    # The endpoint receives a ``course_name``, but the ``useinfo`` table calls this ``course_id``. Rename it.
    useinfo_dict = entry.dict()
    useinfo_dict["course_id"] = useinfo_dict.pop("course_name")
    # This will validate the fields.  If a field does not validate
    # an error will be raised and a 422 response code will be returned
    # to the caller of the API.
    # for the useinfo table act is limited to 512 characters, but some short answers can be
    # longer than 512.  It is fine to limit it in the useinfo table, the full answer will be
    # stored in the answers table.
    useinfo_dict["act"] = useinfo_dict["act"][:512]
    useinfo_entry = UseinfoValidation(**useinfo_dict)
    rslogger.debug(useinfo_entry)
    idx = await create_useinfo_entry(useinfo_entry)
    response_dict = dict(timestamp=entry.timestamp)
    if entry.event in EVENT2TABLE:
        create_answer_table = True
        rcd = runestone_component_dict[EVENT2TABLE[entry.event]]
        if entry.event == "unittest":
            # info we need looks like: "act":"percent:100.0:passed:2:failed:0"
            if not re.match(r"^percent:\d+(\.\d+)?:passed:\d+:failed:\d+$", entry.act):
                return make_json_response(
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="act is not in the correct format",
                )
            ppf = entry.act.split(":")
            entry.passed = int(ppf[3])
            entry.failed = int(ppf[5])
            entry.answer = ""
            entry.correct = ppf[1] == "100.0"
            entry.percent = float(ppf[1])
        elif entry.event == "timedExam":
            if entry.act in ["start", "pause", "resume"]:
                # We don't need these in the answer table but want the event to be timedExam.
                create_answer_table = False
        elif entry.event == "webwork" or entry.event == "hparsonsAnswer":
            entry.answer = json.loads(useinfo_dict["answer"])

        if create_answer_table:
            valid_table = rcd.validator.from_orm(entry)  # type: ignore
            # Do server-side grading if needed.
            if feedback := await is_server_feedback(entry.div_id, user.course_name):
                # The grader should also be defined if there's feedback.
                assert rcd.grader
                response_dict.update(await rcd.grader(valid_table, feedback))

            ans_idx = await create_answer_table_entry(valid_table, entry.event)
            rslogger.debug(ans_idx)

    if idx:
        return make_json_response(status=status.HTTP_201_CREATED, detail=response_dict)
    else:
        return make_json_response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.post("/set_tz_offset")
def set_tz_offset(
    tzreq: TimezoneRequest,
    RS_info: Optional[str] = Cookie(None),
    response_class=JSONResponse,
):
    """Set the timezone offset in the session cookie.

    :param tzreq: The timezone offset.
    :param RS_info: Cookie defaults to Cookie(None)
    :param response_class: JSONResponse
    :return: JSONResponse
    """
    if RS_info:
        try:
            values = json.loads(RS_info)
        except json.decoder.JSONDecodeError:
            values = {}
            rslogger.error(f"Error decoding RS_info cookie: {RS_info}")
    else:
        values = {}
    values["tz_offset"] = tzreq.timezoneoffset
    response = JSONResponse(
        status_code=status.HTTP_200_OK, content=json.dumps({"detail": "success"})
    )
    response.set_cookie(key="RS_info", value=str(json.dumps(values)))
    rslogger.debug(f"setting timezone offset in session {tzreq.timezoneoffset} hours")
    # returning make_json_response here eliminates the cookie
    # See https://github.com/tiangolo/fastapi/issues/2452
    return response


# runlog endpoint
# ---------------
# The :ref:`logRunEvent` client-side function calls this endpoint to record an activecode run
@router.post("/runlog")
async def runlog(request: Request, response: Response, data: LogRunIncoming):
    """Make an entry in the Code table to record an activecode run.

    :param request: A FastAPI Request object
    :param response: A FastAPI Response object
    :type response: JSONResponse
    :param data: the post data
    :type data: LogRunIncoming
    :return: JSONResponse
    """
    # First add a useinfo entry for this run
    rslogger.debug(f"INCOMING: {data}")
    if request.state.user:
        if data.course != request.state.user.course_name:
            return make_json_response(
                status=status.HTTP_401_UNAUTHORIZED,
                detail="You appear to have changed courses in another tab.  Please switch to this course",
            )
        data.sid = request.state.user.username
    else:
        if data.clientLoginStatus == "true":
            rslogger.error("Session Expired")
            return make_json_response(
                status=status.HTTP_401_UNAUTHORIZED, detail="Session Expired"
            )
        else:
            return make_json_response(status=status.HTTP_401_UNAUTHORIZED)

    # everything after this assumes that the user is logged in

    useinfo_dict = data.dict()
    useinfo_dict["course_id"] = useinfo_dict.pop("course")
    useinfo_dict["timestamp"] = datetime.utcnow()
    useinfo_dict["emessage"] = data.errinfo
    if data.errinfo != "success":
        useinfo_dict["event"] = "ac_error"
        useinfo_dict["act"] = str(data.errinfo)[:512]
    else:
        useinfo_dict["act"] = "run"
        if "event" not in useinfo_dict:
            useinfo_dict["event"] = "activecode"

    await create_useinfo_entry(UseinfoValidation(**useinfo_dict))

    # Now add an entry to the code table - in the code table we use the name
    # acid (activecode id) instead of div_id -- just to be difficult
    useinfo_dict["acid"] = useinfo_dict.pop("div_id")
    if data.to_save:
        useinfo_dict["course_id"] = request.state.user.course_id
        entry = CodeValidator(**useinfo_dict)
        await create_code_entry(entry)

        if data.partner:
            if await same_class(request.state.user, data.partner):
                comchar = COMMENT_MAP.get(data.language, "#")
                newcode = f"{comchar} This code was shared by {data.sid}\n\n{data.code}"
                entry.code = newcode
                entry.sid = data.partner
                await create_code_entry(entry)
            else:
                return make_json_response(
                    status=status.HTTP_207_MULTI_STATUS,
                    detail=[
                        {
                            "result": status.HTTP_401_UNAUTHORIZED,
                            "detail": "Partner data not saved, you must be enrolled in the same class as your partner",
                        },
                        {"result": status.HTTP_200_OK, "detail": None},
                    ],
                )

    return make_json_response(status=status.HTTP_201_CREATED)


async def same_class(user1: AuthUserValidator, user2: str) -> bool:
    if user1:
        u2 = await fetch_user(user2)
        if u2:
            return user1.course_id == u2.course_id
    return False


# completion tables
# =================
#
# This section contains implementations of endpoints for tracking progress


# updatelastpage
# --------------
# see :ref:`processPageState`
@router.post("/updatelastpage")
async def updatelastpage(
    request: Request,
    request_data: LastPageDataIncoming,
    RS_info: Optional[str] = Cookie(None),
):
    if request_data.last_page_url is None:
        # This really should never be the case, but...
        rslogger.error(f"No data for last page url {request_data}")
        return make_json_response(detail="No Data")

    if request.state.user:
        lpd = request_data.dict()
        rslogger.debug(f"{lpd=}")
        user = request.state.user

        # last_page_url is going to be .../ns/books/published/course/chapter/subchapter.html
        # We will treat the second to last element as the chapter and the final element
        # minus the .html as the subchapter
        parts = request_data.last_page_url.split("/")
        if len(parts) < 2:
            rslogger.error(f"Unparseable page: {request_data.last_page_url}")
            return make_json_response(
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unparseable page: {request_data.last_page_url}",
            )

        subchapter = ".".join(parts[-1].split(".")[:-1])
        # if it is a PreTeXt book then the subchapter is a unique id with the whole book
        # we can look it up from the chapter and subchapter tables.
        if request_data.is_ptx_book:
            rslogger.debug(f"PreTeXt book {request_data.last_page_url}")
            course_row = await fetch_course(user.course_name)
            chapter = await fetch_chapter_for_subchapter(
                subchapter, course_row.base_course
            )
            rslogger.debug(
                f"Got Chapter {chapter} for {subchapter} in {course_row.base_course}"
            )
            lpd["last_page_chapter"] = chapter or ""
        else:
            lpd["last_page_chapter"] = parts[-2]

        lpd["last_page_subchapter"] = subchapter
        lpd["last_page_accessed_on"] = datetime.utcnow()
        lpd["user_id"] = request.state.user.id

        lpdo: LastPageData = LastPageData(**lpd)
        await update_user_state(lpdo)
        await update_sub_chapter_progress(lpdo)
        # The components don't ever look at a result from this
        # endpoint, but it seems like we should return some
        # indication of success. See below.
    else:
        rslogger.debug("Not Authorized for update last page")
        raise HTTPException(401)

    # If practice is self paced, we may need to add or delete a flashcard for the subchapter as topic.

    practice_settings = await fetch_course_practice(user.course_name)
    if RS_info:
        try:
            values = json.loads(RS_info)
        except:
            values = {}

        tz_offset = float(values.get("tz_offset", 0))
    else:
        tz_offset = 0

    if practice_settings:
        if request_data.markingComplete:
            if practice_settings.flashcard_creation_method == 0:
                # self-paced flashcard creation based on marking a page as complete
                rslogger.debug(
                    f"self-paced flashcard creation based on marking a page as complete\n{request_data=}"
                )
                course = await fetch_course(user.course_name)
                await potentially_change_flashcard(
                    course.base_course,
                    lpd["last_page_chapter"],
                    lpd["last_page_subchapter"],
                    user,
                    tz_offset,
                    add=True,
                )

        elif request_data.markingIncomplete:
            if practice_settings.flashcard_creation_method == 0:
                course = await fetch_course(user.course_name)
                rslogger.debug(
                    f"self-paced flashcard deletion based on marking a page as incomplete\n{request_data=}"
                )
                await potentially_change_flashcard(
                    course.base_course,
                    lpd["last_page_chapter"],
                    lpd["last_page_subchapter"],
                    user,
                    tz_offset,
                    remove=True,
                )
        elif request_data.pageLoad and practice_settings.flashcard_creation_method == 3:
            # self-paced flashcard creation based on loading a page
            course = await fetch_course(user.course_name)
            await potentially_change_flashcard(
                course.base_course,
                lpd["last_page_chapter"],
                lpd["last_page_subchapter"],
                user,
                tz_offset,
                add=True,
            )

    return make_json_response(detail="Success")


# _getCompletionStatus
# --------------------
@router.get("/getCompletionStatus")
async def getCompletionStatus(request: Request, lastPageUrl: str, isPtxBook: bool):
    if request.state.user:
        last_page_subchapter = ".".join(lastPageUrl.split("/")[-1].split(".")[:-1])
        if isPtxBook:
            rslogger.debug(f"completion status for PTX book {lastPageUrl}")
            course_row = await fetch_course(request.state.user.course_name)
            last_page_chapter = await fetch_chapter_for_subchapter(
                last_page_subchapter, course_row.base_course
            )
        else:
            last_page_chapter = lastPageUrl.split("/")[-2]
        if last_page_chapter is None:
            rslogger.error(f"Unparseable page: {lastPageUrl}")
            return make_json_response(
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unparseable page: {lastPageUrl}",
            )
        result = await fetch_user_sub_chapter_progress(
            request.state.user, last_page_chapter, last_page_subchapter
        )
        rowarray_list = []
        if result:
            rslogger.debug(f"{result=}")
            for row in result:
                res = {"completionStatus": row.status}
                rowarray_list.append(res)
                # question: since the javascript in user-highlights.js is going to look only at the first row, shouldn't
                # we be returning just the *last* status? Or is there no history of status kept anyway?
            return make_json_response(detail=rowarray_list)
        else:
            # haven't seen this Chapter/Subchapter before
            # make the insertions into the DB as necessary
            # we know the subchapter doesn't exist
            await create_user_sub_chapter_progress_entry(
                request.state.user, last_page_chapter, last_page_subchapter, status=0
            )
            # the chapter might exist without the subchapter
            result = await fetch_user_chapter_progress(
                request.state.user, last_page_chapter
            )
            if not result:
                await create_user_chapter_progress_entry(
                    request.state.user, last_page_chapter, -1
                )
            return make_json_response(detail=[{"completionStatus": -1}])
    else:
        raise HTTPException(401)


# _getAllCompletionStatus
# -----------------------
# This is called to decorate the table of contents for a book
# See :ref:`decorateTableOfContents`
#
@router.get("/getAllCompletionStatus")
async def getAllCompletionStatus(request: Request):
    if request.state.user:
        result = await fetch_user_sub_chapter_progress(request.state.user)

        rowarray_list = []
        if result:
            for row in result:
                if row.end_date is None:
                    endDate = 0
                else:
                    endDate = row.end_date.strftime("%d %b, %Y")
                res = {
                    "chapterName": row.chapter_id,
                    "subChapterName": row.sub_chapter_id,
                    "completionStatus": row.status,
                    "endDate": endDate,
                }
                rowarray_list.append(res)
            return make_json_response(detail=rowarray_list)
        else:
            return make_json_response(detail="None")
    else:
        raise HTTPException(401)


#
# See :ref:`decorateTableOfContents`
#
@router.get("/getlastpage")
async def getlastpage(request: Request, course: str):
    if not request.state.user:
        raise HTTPException(401)

    row = await fetch_last_page(request.state.user, course)
    rslogger.debug(f"ROW = {row}")
    if row:
        res = {
            "lastPageUrl": row.last_page_url,
            "lastPageHash": row.last_page_hash,
            "lastPageChapter": row.chapter_name,
            "lastPageSubchapter": row.sub_chapter_name,
            "lastPageScrollLocation": row.last_page_scroll_location,
        }
        return make_json_response(detail=res)
    else:
        rslogger.debug("Creating user state entry")
        res = await create_user_state_entry(request.state.user.id, course)
        return make_json_response(detail=res)


#
# Use the AWS S3 API to manage updloaded files.
# The files should be stored in their bucket -- stored in Environment
# using coursename/student_id/div_id_filename.ext
# this will allow for easy recovery.
@router.post("/upload/{div_id:str}")
async def create_upload_file(request: Request, file: UploadFile, div_id: str):
    if not request.state.user:
        raise HTTPException(401)

    session = boto3.session.Session()
    client = session.client(
        "s3",
        config=botocore.config.Config(s3={"addressing_style": "virtual"}),
        region_name=settings.region,
        endpoint_url="https://nyc3.digitaloceanspaces.com",
        aws_access_key_id=settings.spaces_key,
        aws_secret_access_key=settings.spaces_secret,
    )

    contents = await file.read()  # these contents are bytes not a string

    # create the file Key
    fkey = f"{request.state.user.course_name}/{div_id}/{request.state.user.username}/{file.filename}"
    rslogger.debug("file key = {fkey} {settings.spaces_key} {settings.spaces_secret}")
    client.put_object(
        Bucket=settings.bucket,
        Key=fkey,
        Body=contents,
        ACL="private",
        Metadata={"x-amz-meta-my-key": "your-value"},
    )

    return {"filename": file.filename}
