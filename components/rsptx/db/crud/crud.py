# *************************************************
# |docname| - reusable functions for our data model
# *************************************************
"""
Create Retrieve Update and Delete (CRUD) functions for database tables

Rather than litter the code with raw database queries the vast majority should be
turned into reusable functions that are defined in this file.

"""
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import datetime
import hashlib
import json
from typing import Dict, Optional, Any
import textwrap
import traceback


# Third-party imports
# -------------------

from sqlalchemy.sql import select
from sqlalchemy.orm import attributes
from starlette.requests import Request


# Local application imports
# -------------------------
from rsptx.logging import rslogger
from ..async_session import async_session
from rsptx.response_helpers.core import canonical_utcnow
from rsptx.db.models import (
    AuthUserValidator,
    Courses,
    CoursesValidator,
    DomainApprovals,
    InvoiceRequest,
    Question,
    TraceBack,
    APIToken,
    APITokenValidator,
)
from .course import create_course
from .user import create_user

# Map from the ``event`` field of a ``LogItemIncoming`` to the database table used to store data associated with this event.
EVENT2TABLE = {
    "clickableArea": "clickablearea_answers",
    "codelens": "codelens_answers",
    "dragNdrop": "dragndrop_answers",
    "fillb": "fitb_answers",
    "lp_build": "lp_answers",
    "matching": "matching_answers",
    "mChoice": "mchoice_answers",
    "parsons": "parsons_answers",
    "shortanswer": "shortanswer_answers",
    "unittest": "unittest_answers",
    "timedExam": "timed_exam",
    "webwork": "webwork_answers",
    "hparsonsAnswer": "microparsons_answers",
    "SPLICE.score": "splice_answers",
    "SPLICE.reportScoreAndState": "splice_answers",
    "SPLICE.getState": "splice_answers",
}


# Server-side grading
# -------------------
# Return the feedback associated with this question if this question should be graded on the server instead of on the client; otherwise, return None.
async def is_server_feedback(div_id: str, course: str) -> Optional[Dict[str, Any]]:
    """
    Check if server feedback is available for the given div id (div_id) and course name (course).
    If server feedback is available and login is required, return the decoded feedback.

    :param div_id: str, the id of the div element
    :param course: str, the name of the course
    :return: Optional[Dict[str, Any]], a dictionary representing the decoded feedback (if available)
    """
    # Get the information about this question.
    query = (
        select(Question, Courses)
        .where(Question.name == div_id)
        .join(Courses, Question.base_course == Courses.base_course)
        .where(Courses.course_name == course)
    )
    async with async_session() as session:
        query_results = (await session.execute(query)).first()

        # Get the feedback, if it exists.
        feedback = query_results and query_results.Question.feedback
        # If there's feedback and a login is required (necessary for server-side grading), return the decoded feedback.
        try:
            if feedback and query_results.Courses.login_required:
                # Decode the feedback from JSON.
                return json.loads(feedback)
        except json.JSONDecodeError as e:
            rslogger.error(
                f"Failed to decode feedback for div_id {div_id} in course {course}: {e}"
            )
            # If decoding fails, we log the error and return None.
            return None
        # Otherwise, grade on the client.
        return None


# Development and Testing Utils
# -----------------------------


async def create_initial_courses_users():
    """
    This function populates the database with the common base courses and creates a test user.
    """
    BASE_COURSES = [
        "boguscourse",
        "ac1",
        "cppds",
        "cppforpython",
        "csawesome",
        "csjava",
        "fopp",
        "httlads",
        "java4python",
        "JS4Python",
        "learnwebgl2",
        "MasteringDatabases",
        "overview",
        "py4e-int",
        "pythonds",
        "pythonds3",
        "StudentCSP",
        "TeacherCSP",
        "thinkcpp",
        "thinkcspy",
        "webfundamentals",
        "test_course_1",
    ]

    for c in BASE_COURSES:
        new_course = CoursesValidator(
            course_name=c,
            base_course=c,
            term_start_date=datetime.date(2000, 1, 1),
            login_required=False,
            allow_pairs=False,
            downloads_enabled=False,
            courselevel="",
            institution="",
            new_server=True,
        )
        await create_course(new_course)
    # Make a user. TODO: should we not do this for production?
    await create_user(
        AuthUserValidator(
            username="testuser1",
            first_name="test",
            last_name="user",
            password="xxx",
            email="testuser1@example.com",
            course_name="overview",
            course_id=BASE_COURSES.index("overview") + 1,
            donated=True,
            active=True,
            accept_tcp=True,
            created_on=datetime.datetime(2020, 1, 1, 0, 0, 0),
            modified_on=datetime.datetime(2020, 1, 1, 0, 0, 0),
            registration_key="",
            registration_id="",
            reset_password_key="",
        )
    )


async def create_traceback(exc: Exception, request: Request, host: str):
    """
    Create a new TraceBack entry with the given Exception, Request, and host.

    :param exc: Exception, the exception that occurred
    :param request: Request, the request object
    :param host: str, the hostname
    """
    async with async_session.begin() as session:
        tbtext = "".join(traceback.format_tb(exc.__traceback__))
        # walk the stack trace and collect local variables into a dictionary
        curr = exc.__traceback__
        dl = []
        while curr is not None:
            frame = curr.tb_frame
            name = frame.f_code.co_name
            local_vars = frame.f_locals
            dl.append(dict(name=name, local_vars=local_vars))
            curr = curr.tb_next
        rslogger.debug(f"{dl[-2:]=}")

        new_entry = TraceBack(
            traceback=tbtext + "\n".join(textwrap.wrap(str(dl[-2:]), 80)),
            timestamp=canonical_utcnow(),
            err_message=str(exc)[:512],
            path=request.url.path[:1024],
            query_string=str(request.query_params)[:512],
            hash=hashlib.md5(tbtext.encode("utf8")).hexdigest(),
            hostname=host,
        )
        session.add(new_entry)


async def create_invoice_request(
    user_id: str, course_name: str, amount: float, email: str
) -> InvoiceRequest:
    """
    Create a new invoice request.

    :param user_id: str, the id of the user
    :param course_name: str, the name of the course
    :param amount: float, the amount of the invoice
    :param email: str, the email address of the user
    :return: InvoiceRequest, the InvoiceRequest object
    """
    new_entry = InvoiceRequest(
        sid=user_id,
        course_name=course_name,
        amount=amount,
        email=email,
        timestamp=canonical_utcnow(),
        processed=False,
    )
    async with async_session.begin() as session:
        session.add(new_entry)

    return new_entry


# new function to create encrypted API tokens
async def create_api_token(
    course_id: int,
    provider: str,
    token: str,
) -> APITokenValidator:
    """
    Create a new API token for a course with encrypted storage.

    :param course_id: int, the id of the course
    :param provider: str, the provider name
    :param token: str, plaintext token to encrypt and store
    :return: APITokenValidator, the newly created token record
    """
    new_token = APIToken(course_id=course_id, provider=provider, token=token)
    async with async_session.begin() as session:
        session.add(new_token)
    return APITokenValidator.from_orm(new_token)


async def fetch_api_token(
    course_id: int,
    provider: str,
) -> Optional[APITokenValidator]:
    """
    Fetch the least recently used API token for a given course and provider.
    Updates the last_used field to the current datetime when returning a token.

    :param course_id: int, the id of the course
    :param provider: str, the provider name
    :return: Optional[APITokenValidator], the least recently used token or None if not found
    """
    query = (
        select(APIToken)
        .where((APIToken.course_id == course_id) & (APIToken.provider == provider))
        .order_by(
            APIToken.last_used.asc().nulls_first()
        )  # Least recently used first, NULL values first
        .limit(1)
    )

    async with async_session.begin() as session:
        res = await session.execute(query)
        token = res.scalars().first()
        if token:
            # Update the last_used field to current datetime
            token.last_used = canonical_utcnow()
            session.add(token)
            return APITokenValidator.from_orm(token)
        return None


# DomainApprovals
# ------------------
async def check_domain_approval(
    domain_name: str, approval_type: attributes.InstrumentedAttribute
) -> bool:
    """
    Check if a domain approval exists for a given approval type.
    :param domain_name: str, domain name to verify
    :param approval_type: sqlalchemy.orm.attributes.InstrumentedAttribute, the type of approval (e.g., 'DomainApprovals.lti1p3')
    """
    query = select(DomainApprovals.domain_name).where(
        (approval_type == True)  # noqa: E712
        & (DomainApprovals.domain_name == domain_name)  # noqa: E712
    )
    async with async_session() as session:
        res = await session.execute(query)
        domain = res.scalars().first()
        return domain is not None


async def create_domain_approval(
    domain_name: str, approval_type: attributes.InstrumentedAttribute
) -> DomainApprovals:
    """
    Create a new domain approval for a given domain name and approval type.
    :param domain_name: str, the domain name to approve
    :param approval_type: sqlalchemy.orm.attributes.InstrumentedAttribute, the type of approval (e.g., 'DomainApprovals.lti1p3')
    """
    new_approval = DomainApprovals(
        domain_name=domain_name, **{approval_type.name: True}
    )
    async with async_session.begin() as session:
        session.add(new_approval)
    return new_approval
