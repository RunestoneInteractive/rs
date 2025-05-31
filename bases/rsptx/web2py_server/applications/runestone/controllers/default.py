# -*- coding: utf-8 -*-
import json
import os
import requests
import datetime
from six.moves.urllib.parse import unquote
from six.moves.urllib.error import HTTPError
import logging
import subprocess
import jwt

from gluon.restricted import RestrictedError
from gluon.http import HTTP
from stripe_form import StripeForm

logger = logging.getLogger(settings.logger)
logger.setLevel(settings.log_level)


def user():
    # this is kinda hacky but it's the only way I can figure out how to pre-populate
    # the course_id field
    if not request.args(0):
        redirect(URL("default", "user/login"))

    library_list = []
    if "register" in request.args(0):
        # If we can't pre-populate, just set it to blank.
        # This will force the user to choose a valid course name
        db.auth_user.course_id.default = ""
        library_list = db.executesql(
            """select basecourse, title
               from library
               where for_classes = 'T' and is_visible = 'T'
               order by shelf_section, basecourse""",
            as_dict=True,
        )
        # Otherwise, use the referer URL to try to pre-populate
        ref = request.env.http_referer
        if ref:
            ref = unquote(ref)
            if "_next" in ref:
                ref = ref.split("_next")
                url_parts = ref[1].split("/")
            else:
                url_parts = ref.split("/")

            for i in range(len(url_parts)):
                if "static" == url_parts[i]:
                    course_name = url_parts[i + 1]
                    db.auth_user.course_id.default = course_name
                    break
    try:
        # After the registration form is submitted the registration is processed here
        # this function will not return in that case, but instead continue on and end up
        # redirecting to index.
        # through db.auth_user._after_insert.append(some_function)
        form = auth()
    except HTTPError:
        session.flash = (
            "Sorry, that service failed.  Try a different service or file a bug"
        )
        redirect(URL("default", "index"))

    if "profile" in request.args(0):
        # Make the username read-only.
        form.element("#auth_user_username")["_readonly"] = True

        form.vars.course_id = auth.user.course_name
        if form.validate():
            # Prevent the username from being changed by deleting it before the update. See http://web2py.com/books/default/chapter/29/07/forms-and-validators#SQLFORM-without-database-IO.
            del form.vars.username
            form.record.update_record(**dict(form.vars))
            # auth.user session object doesn't automatically update when the DB gets updated
            auth.user.update(form.vars)

            redirect(URL("default", "index"))

    if "register" in request.args(0):
        # The validation function ``IS_COURSE_ID`` in ``models/db.py`` changes the course name supplied to a course ID. If the overall form doesn't validate, the value when the form is re-displayed with errors will contain the ID instead of the course name. Change it back to the course name. Note: if the user enters a course for the course name, it will be displayed as the corresponding course name after a failed validation. I don't think this case is important enough to fix.
        try:
            course_id = int(form.vars.course_id)
        except Exception:
            pass
        else:
            # Look up the course name based on the ID.
            form.vars.course_id = getCourseNameFromId(course_id)

    # this looks horrible but it seems to be the only way to add a CSS class to the submit button
    try:
        form.element(_id="submit_record__row")[1][0]["_class"] = "btn btn-default"
    except (
        AttributeError,
        TypeError,
    ):  # not all auth methods actually have a submit button (e.g. user/not_authorized)
        pass
    return dict(form=form, library=library_list)


# Can use db.auth_user._after_insert.append(make_section_entries)
# to add a custom function to deal with donation and/or creating a course
# May have to disable auto_login ??


def download():
    return response.download(request, db)


def call():
    return service()


# Determine the student price for a given ``course_id``. Returns a value in cents, where 0 cents indicates a free book.
def _course_price(course_id):
    # Look for a student price for this course.
    course = (
        db(db.courses.id == course_id)
        .select(db.courses.student_price, db.courses.base_course)
        .first()
    )
    assert course
    price = course.student_price
    base_course_name = course.base_course
    # See if the student owns this base course.
    base_course_owned = (
        db(
            (db.user_courses.user_id == auth.user.id)
            & (db.user_courses.course_id == db.courses.id)
            & (db.courses.base_course == base_course_name)
        )
        .select(db.user_courses.id)
        .first()
    )
    # If so, then this course is free.
    if base_course_owned:
        price = 0
    # Only look deeper if a price isn't set (even a price of 0).
    if price is None:
        # Get the base course's price.
        base_course = (
            db(db.courses.course_name == base_course_name)
            .select(db.courses.student_price)
            .first()
        )
        # Paranoia. Every course should have a valid base course name, so this should always be true...
        if base_course:
            price = base_course.student_price
    # If price is ``None`` or negative, return a free course.
    return max(price or 0, 0)


@auth.requires_login()
def payment():
    # The payment will be made for ``auth.user.course_id``. Get the corresponding course name.
    course = (
        db(db.courses.id == auth.user.course_id).select(db.courses.course_name).first()
    )
    assert course.course_name
    form = StripeForm(
        pk=settings.STRIPE_PUBLISHABLE_KEY,
        sk=settings.STRIPE_SECRET_KEY,
        amount=_course_price(auth.user.course_id),
        description="Access to the {} textbook from {}".format(
            course.course_name, settings.title
        ),
    ).process()
    if form.accepted:
        # Save the payment info, then redirect to the index.
        user_courses_id = db.user_courses.insert(
            user_id=auth.user.id, course_id=auth.user.course_id
        )
        db.payments.insert(
            user_courses_id=user_courses_id, charge_id=form.response["id"]
        )
        db.commit()
        return dict(request=request, course=course, payment_success=True)
    elif form.errors:
        return dict(form=form, payment_success=False)
    # Fix up CSS -- the ``hidden`` attribute hides any error feedback.
    html = form.xml().replace('"payment-errors error hidden"', '"payment-errors error"')
    return dict(html=html, payment_success=None)


def w2py_login():
    """
    Allows external services (like fastapi based services) to login a user by username
    expects a jwt encoded token in the request.vars["token"] field (encoded using the jwt_secret)
    that should have a registration_id field with the registration_id to use for the web2py user
    """
    logger.debug("Generating web2py token")
    token = request.vars["token"]
    print(token)
    try:
        if not token:
            err = "No token provided to w2py_login"
            raise Exception(err)

        decoded = jwt.decode(token, settings.jwt_secret, "HS256")
        if not decoded:
            err = "Invalid token provided to w2py_login"
            raise Exception(err)

        user = db(db.auth_user.registration_id == decoded["registration_id"]).select().first()
        if not user:
            err = "Unkonwn user in token provided to w2py_login"
            raise Exception(err)

        auth.login_user(user)
        return "User logged in"
    except Exception as e:
        logger.error(f"Error in w2py_login: {e}")
        raise HTTP(400, err)

def index():
    #    print("REFERER = ", request.env.http_referer)
    if not auth.user:
        if os.environ.get("LOAD_BALANCER_HOST", False) == "runestone.academy":
            if request.env.http_host == "staging.runestoneacademy.org":
                redirect("https://author.runestone.academy/author")
            redirect("https://landing.runestone.academy")
        else:
            redirect(URL("default", "user", args="login"))

    course = (
        db(db.courses.id == auth.user.course_id)
        .select(db.courses.course_name, db.courses.base_course, db.courses.is_supporter)
        .first()
    )

    if not course or "boguscourse" in course.course_name:
        # if login was handled by Janrain, user didn't have a chance to choose the course_id;
        # redirect them to the profile page to choose one
        redirect(
            "/%s/default/user/profile?_next=/%s/default/index"
            % (request.application, request.application)
        )
    else:
        # At this point the user has logged in
        # add a jwt cookie for compatibility with bookserver
        create_rs_token()
        # check to see if there is an entry in user_courses for
        # this user,course configuration
        in_db = db(
            (db.user_courses.user_id == auth.user.id)
            & (db.user_courses.course_id == auth.user.course_id)
        ).select()
        db_check = []
        for row in in_db:
            db_check.append(row)
        if not db_check:
            # The user hasn't been enrolled in this course yet. Check the price for the course.
            db.user_courses.insert(user_id=auth.user.id, course_id=auth.user.course_id)
            db(db.auth_user.id == auth.user.id).update(active="T")
            price = _course_price(auth.user.course_id)
            # If the price is non-zero, then require a payment. Otherwise, ask for a donation.
            if price > 0:
                redirect(URL("payment"))
            elif course.is_supporter:
                # If the course is a supporter course, then skip the  donation page
                redirect("/ns/course/index")
            else:
                session.request_donation = True
        try:
            logger.debug(
                f"INDEX - checking for progress table for {course.base_course}"
            )
            chapter_label = (
                db(db.chapters.course_id == course.base_course)
                .select()
                .first()
                .chapter_label
            )
            logger.debug(
                "LABEL = %s user_id = %s course_name = %s",
                chapter_label,
                auth.user.id,
                auth.user.course_name,
            )
            if (
                db(
                    (db.user_sub_chapter_progress.user_id == auth.user.id)
                    & (db.user_sub_chapter_progress.chapter_id == chapter_label)
                    & (db.user_sub_chapter_progress.course_name == course.course_name)
                ).count()
                == 0
            ):
                db.executesql(
                    """
                    INSERT INTO user_sub_chapter_progress(user_id, chapter_id,sub_chapter_id, status, start_date, course_name)
                    SELECT %(userid)s, chapters.chapter_label, sub_chapters.sub_chapter_label, -1, now(), %(course_name)s
                    FROM chapters, sub_chapters where sub_chapters.chapter_id = chapters.id and chapters.course_id = %(base_course)s
                """,
                    dict(
                        userid=auth.user.id,
                        course_name=course.course_name,
                        base_course=course.base_course,
                    ),
                )
        except Exception as e:
            logger.error(f"Select Course got Error {e}")
            session.flash = f"{course.course_name} is not set up to track your progress"
        # todo:  check course.course_name make sure it is valid if not then redirect to a nicer page.

        if session.request_donation:
            del session.request_donation
            redirect(URL(c="default", f="donate"))

        if session.build_course:
            del session.build_course
            redirect(URL(c="designer", f="index"))

        # See if we need to do a redirect from LTI.
        if session.lti_url_next:
            # This is a one-time redirect.
            del session.lti_url_next
            redirect(session.lti_url_next)

        # check number of classes, if more than 1, send to course selection, if only 1, send to book
        num_courses = db(db.user_courses.user_id == auth.user.id).count()
        # Don't redirect when there's only one course for testing. Since the static files don't exist, this produces a server error ``invalid file``.
        if num_courses == 1 and os.environ.get("WEB2PY_CONFIG") != "test":
            redirect("/ns/course/index")
        elif course.course_name == course.base_course:
            redirect(get_course_url("index.html"))
        redirect("/ns/course/index")


def error():
    # As recommended in http://web2py.com/books/default/chapter/29/04/the-core#Routes-on-error, pass on the error code that brought us here. TODO: This actually returns a 500 (Internal server error). ???
    # response.status = request.vars.code
    return dict()


def about():
    return dict()


def ack():
    return dict()


def start():
    return dict()


@auth.requires_login()
def courses():
    if "access_token" not in request.cookies:
        # The user is only partially logged in.
        logger.error(f"Missing Access Token: {auth.user.username} adding one Now")
        create_rs_token()

    if request.vars.requested_course:
        # We have a mismatch between the requested course and the current course
        # in the database
        response.flash = f"You requested {request.vars.requested_course} but are logged in to {request.vars.current_course}"
    res = db(db.user_courses.user_id == auth.user.id).select(
        db.user_courses.course_id, orderby=~db.user_courses.id
    )
    instructor = db(db.course_instructor.instructor == auth.user.id).select()
    iset = set()
    for row in instructor:
        iset.add(row.course)
    logger.debug("Instructor set = %s", iset)
    classlist = []
    bclist = []
    for row in res:
        classes = db(db.courses.id == row.course_id).select()
        for part in classes:
            if part.base_course == part.course_name:
                bclist.append(
                    {"course_name": part.course_name, "is_instructor": part.id in iset}
                )
            else:
                classlist.append(
                    {"course_name": part.course_name, "is_instructor": part.id in iset}
                )
    pagepath = request.vars.requested_path
    if not pagepath:
        pagepath = "index.html"
    return dict(
        courses=classlist,
        bclist=bclist,
        requested_course=request.vars.requested_course,
        pagepath=pagepath,
    )


@auth.requires_login()
def remove():
    res = db(db.user_courses.user_id == auth.user.id).select(
        db.user_courses.course_id, orderby=~db.user_courses.id
    )
    classlist = []
    for row in res:
        classes = db(db.courses.id == row.course_id).select()
        for part in classes:
            classlist.append(part.course_name)
    return dict(courses=classlist)


@auth.requires_login()
def coursechooser():
    if not request.args(0):
        redirect(URL("default", "courses"))

    res = (
        db(db.courses.course_name == request.args[0])
        .select(db.courses.id, db.courses.base_course)
        .first()
    )

    if res:
        db(db.auth_user.id == auth.user.id).update(course_id=res.id, active="T")
        db(db.auth_user.id == auth.user.id).update(course_name=request.args[0])
        auth.user.update(course_name=request.args[0])
        auth.user.update(course_id=res.id)
        res1 = db(db.chapters.course_id == auth.user.course_name)
        logger.debug("COURSECHOOSER checking for progress table %s ", res)
        if res1.count() > 0:
            chapter_label = res1.select().first().chapter_label
            if (
                db(
                    (db.user_sub_chapter_progress.user_id == auth.user.id)
                    & (db.user_sub_chapter_progress.chapter_id == chapter_label)
                ).count()
                == 0
            ):
                logger.debug(
                    "SETTING UP PROGRESS for %s %s",
                    auth.user.username,
                    auth.user.course_name,
                )
                db.executesql(
                    """
                    INSERT INTO user_sub_chapter_progress(user_id, chapter_id,sub_chapter_id, status)
                    SELECT %s, chapters.chapter_label, sub_chapters.sub_chapter_label, -1
                    FROM chapters, sub_chapters where sub_chapters.chapter_id = chapters.id and chapters.course_id = %s;
                """,
                    (auth.user.id, auth.user.course_name),
                )
        if request.args[0] == res.base_course:
            redirect(get_course_url("index.html"))
        redirect("/ns/course/index")
    else:
        redirect(
            "/%s/default/user/profile?_next=/%s/default/index"
            % (request.application, request.application)
        )


@auth.requires_login()
def removecourse():
    admin_logger(logger)
    if not request.args(0):
        redirect(URL("default", "courses"))

    if settings.academy_mode:
        course_id_query = (
            db(db.courses.course_name == request.args[0]).select(db.courses.id).first()
        )
        # Redirect if this course wasn't found.
        if not course_id_query:
            redirect(URL("default", "courses"))

        # todo: properly encode course_names to handle courses with special characters
        # Check if they're about to remove their currently active course
        auth_query = db(db.auth_user.id == auth.user.id).select()
        for row in auth_query:
            if row.course_name == request.args[0] and course_id_query:
                session.flash = T(
                    "Sorry, you cannot remove your current active course."
                )
            else:
                db(
                    (db.user_courses.user_id == auth.user.id)
                    & (db.user_courses.course_id == course_id_query.id)
                ).delete()

    redirect("/%s/default/courses" % request.application)


def reportabug():
    path = os.path.join(request.folder, "errors")
    course = request.vars["course"]
    uri = request.vars["page"]
    username = "anonymous"
    email = "anonymous"
    code = None
    ticket = None
    registered_user = False

    if request.vars.code:
        code = request.vars.code
        ticket = request.vars.ticket.split("/")[1]
        uri = request.vars.requested_uri
        error = RestrictedError()
        error.load(request, request.application, os.path.join(path, ticket))
        ticket = error.traceback

    if auth.user:
        username = auth.user.username
        email = auth.user.email
        course = auth.user.course_name
        registered_user = True

    return dict(
        course=course,
        uri=uri,
        username=username,
        email=email,
        code=code,
        ticket=ticket,
        registered_user=registered_user,
    )


@auth.requires_login()
def sendreport():
    if settings.academy_mode:
        if request.vars["bookerror"] == "on":
            basecourse = (
                db(db.courses.course_name == request.vars["coursename"])
                .select()
                .first()
                .base_course
            )
            if basecourse is None:
                url = (
                    "https://api.github.com/repos/RunestoneInteractive/%s/issues"
                    % request.vars["coursename"]
                )
            else:
                url = (
                    "https://api.github.com/repos/RunestoneInteractive/%s/issues"
                    % basecourse
                )
        else:
            url = "https://api.github.com/repos/RunestoneInteractive/RunestoneComponents/issues"
        reqsession = requests.Session()
        reqsession.auth = ("token", settings.github_token)
        coursename = (
            request.vars["coursename"]
            if request.vars["coursename"]
            else "None Provided"
        )
        pagename = (
            request.vars["pagename"] if request.vars["pagename"] else "None Provided"
        )
        details = (
            request.vars["bugdetails"]
            if request.vars["bugdetails"]
            else "None Provided"
        )
        uname = request.vars["username"] if request.vars["username"] else "anonymous"
        uemail = request.vars["useremail"] if request.vars["useremail"] else "no_email"
        userinfo = uname + " " + uemail

        body = (
            "Error reported in course "
            + coursename
            + " on page "
            + pagename
            + " by user "
            + userinfo
            + "\n"
            + details
        )
        issue = {"title": request.vars["bugtitle"], "body": body}
        logger.debug("POSTING ISSUE %s ", issue)
        r = reqsession.post(url, json.dumps(issue))
        if r.status_code == 201:
            session.flash = 'Successfully created Issue "%s"' % request.vars["bugtitle"]
        else:
            session.flash = 'Could not create Issue "%s"' % request.vars["bugtitle"]
        logger.debug("POST STATUS = %s", r.status_code)

        course_check = 0
        if auth.user:
            course_check = db(db.user_courses.user_id == auth.user.id).count()

        if course_check == 1 and request.vars["coursename"]:
            redirect(
                "/%s/static/%s/index.html"
                % (request.application, request.vars["coursename"])
            )
        elif course_check > 1:
            redirect("/%s/default/courses" % request.application)
        else:
            redirect("/%s/default/" % request.application)
    redirect("/%s/default/" % request.application)


def terms():
    return dict(terms={})


def privacy():
    return dict(private={})


def wisp():
    return dict(wisp={})


def ads():
    return dict(wisp={})


def ct_addendum():
    return dict(private={})


def ca_addendum():
    return dict(private={})


def donate():
    admin_logger(logger)
    if request.vars.donate:
        amt = request.vars.donate
    elif session.donate:
        amt = session.donate
    else:
        amt = None
    return dict(donate=amt)


def accessIssue():
    if auth.user:
        return dict(access={})
    else:
        return redirect(URL("default", "user/login"))


@auth.requires_login()
def delete():
    admin_logger(logger)
    if request.vars["deleteaccount"]:
        logger.error(
            "deleting account {} for {}".format(auth.user.id, auth.user.username)
        )
        session.flash = "Account Deleted"
        db(db.auth_user.id == auth.user.id).delete()
        # Commit changes before asking an external program to change the database. This avoids a deadlock when testing.
        db.commit()
        subprocess.call(
            [
                settings.python_interpreter,
                "-m",
                "rsmanage",
                "rmuser",
                "--username",
                auth.user.username,
            ]
        )
        auth.logout()  # logout user and redirect to home page
    else:
        redirect(URL("default", "user/profile"))


@auth.requires_login()
def enroll():
    logger.debug(f"Request to login for {request.vars.course_name}")
    course = db(db.courses.course_name == request.vars.course_name).select().first()
    # is the user already registered for this course?
    res = (
        db(
            (db.user_courses.course_id == course.id)
            & (db.user_courses.user_id == auth.user.id)
        )
        .select()
        .first()
    )
    if res:
        session.flash = f"You are already registered for {request.vars.course_name}"
        redirect(URL("default", "courses"))

    db.user_courses.insert(user_id=auth.user.id, course_id=course.id)
    db(db.auth_user.id == auth.user.id).update(course_id=course.id, active="T")
    db(db.auth_user.id == auth.user.id).update(course_name=request.vars.course_name)
    auth.user.update(course_name=request.course_name)
    auth.user.update(course_id=course.id)

    redirect(URL("default", "donate"))
