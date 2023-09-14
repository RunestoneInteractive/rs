# ************************************************************
# |docname| -- Define validation for endpoint query parameters
# ************************************************************
# This file contains the models we use for post requests and for type checking throughout the application.
# These object models should be used wherever possible to ensure consistency

# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
from datetime import datetime
from dateutil.parser import isoparse
from typing import Container, Optional, Type, Dict, Tuple, Any, Union

# Third-party imports
# -------------------
from pydantic import field_validator, StringConstraints, ConfigDict, BaseModel, BaseConfig, create_model, Field
from humps import camelize  # type: ignore
from typing_extensions import Annotated

# Local application imports
# -------------------------
# None.


# Schema generation
# =================
# Change the ``BaseModel.from_orm`` method to return ``None`` if the input was ``None``, instead of a class full of variables set to ``None``.
class BaseModelNone(BaseModel):
    @classmethod
    def from_orm(cls, obj):
        return None if obj is None else super().from_orm(obj)
    model_config = ConfigDict(from_attributes=True)


# This creates then returns a Pydantic schema from a SQLAlchemy Table or ORM class.
#
# This is copied from https://github.com/tiangolo/pydantic-sqlalchemy/blob/master/pydantic_sqlalchemy/main.py then lightly modified.
def sqlalchemy_to_pydantic(
    # The SQLAlchemy model -- either a Table object or a class derived from a declarative base.
    db_model: Type,
    *,
    # An optional Pydantic `model config <https://pydantic-docs.helpmanual.io/usage/model_config/>`_ class to embed in the resulting schema.
    config: Optional[Type[BaseConfig]] = None,
    # The base class from which the Pydantic model will inherit.
    base: Type[BaseModel] = BaseModelNone,
    # SQLAlchemy fields to exclude from the resulting schema, provided as a sequence of field names. Ignore the id field by default.
    exclude: Container[str] = tuple(),
):

    # If provided an ORM model, get the underlying Table object.
    db_model = getattr(db_model, "__table__", db_model)

    fields: Dict[str, Union[Tuple[Type, Any], Type[BaseConfig]]] = {}
    for column in db_model.columns:
        # Determine the name of this column.
        name = column.key
        if name in exclude:
            continue

        # Determine the Python type of the column.
        python_type = column.type.python_type
        if python_type == str and hasattr(column.type, "length"):
            python_type = Annotated[str, StringConstraints(max_length=column.type.length)]

        # Determine if the column can be null, meaning it's optional from a Pydantic perspective. Make the id column optional, since it won't be present when inserting values to the database.
        if column.nullable or name == "id":
            python_type = Optional[python_type]

        # Determine the default value for the column. Allow the id column to be null.
        default = column.default
        if callable(default):
            default = column.default()
        if column.default is None and not column.nullable and name != "id":
            default = ...

        # Build the schema based on this info.
        fields[name] = (python_type, default)

    # See `create_model <https://pydantic-docs.helpmanual.io/usage/models/#dynamic-model-creation>`_.
    if config:
        fields["__config__"] = config
    pydantic_model = create_model(str(db_model.name), __base__=base, **fields)  # type: ignore
    return pydantic_model


# Schemas
# =======
class LogItemIncoming(BaseModelNone):
    """
    This class defines the schema for what we can expect to get from a logging event.
    Because we are using pydantic type verification happens automatically, if we want
    to add additional constraints we can do so.
    """

    event: str
    act: str
    div_id: str
    course_name: str
    sid: Optional[str] = None
    answer: Optional[str] = None
    correct: Optional[Union[bool, int]] = None
    percent: Optional[float] = None
    clientLoginStatus: Optional[bool] = None
    timezoneoffset: Optional[int] = None
    timestamp: Optional[datetime] = None
    chapter: Optional[str] = None
    subchapter: Optional[str] = None
    # used by parsons
    source: Optional[str] = None
    # used by dnd
    min_height: Optional[int] = None
    # used by unittest
    passed: Optional[int] = None
    failed: Optional[int] = None
    # used by timed exam
    incorrect: Optional[int] = None
    skipped: Optional[int] = None
    time_taken: Optional[int] = None


class AssessmentRequest(BaseModelNone):
    course: str
    div_id: str
    event: str
    sid: Optional[str] = None
    # See `Field with dynamic default value <https://pydantic-docs.helpmanual.io/usage/models/#required-optional-fields>`_.
    deadline: datetime = Field(default_factory=datetime.utcnow)
    # TODO[pydantic]: The following keys were removed: `json_encoders`.
    # Check https://docs.pydantic.dev/dev-v2/migration/#changes-to-config for more information.
    model_config = ConfigDict(json_encoders={
        datetime: lambda v: v.isoformat(),
    })

    @field_validator("deadline", mode="before")
    @classmethod
    def time_validate(cls, v):
        # return datetime.fromisoformat(v)
        return isoparse(v)

    # @validator("deadline")
    # def str_to_datetime(cls, value: str) -> datetime:
    #     # TODO: this code probably doesn't work.
    #     try:
    #         deadline = parse(canonicalize_tz(value))
    #         # TODO: session isn't defined. Here's a temporary fix
    #         # tzoff = session.timezoneoffset if session.timezoneoffset else 0
    #         tzoff = 0
    #         deadline = deadline + timedelta(hours=float(tzoff))
    #         deadline = deadline.replace(tzinfo=None)
    #     except Exception:
    #         # TODO: can this enclose just the parse code? Or can an error be raised in other cases?
    #         raise ValueError(f"Bad Timezone - {value}")
    #     return deadline


class TimezoneRequest(BaseModelNone):
    timezoneoffset: int


class LogRunIncoming(BaseModelNone):
    div_id: str
    code: str
    errinfo: str
    to_save: bool
    course: str
    clientLoginStatus: bool
    timezoneoffset: int
    language: str
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    partner: Optional[str] = None
    sid: Optional[str] = None


# Schemas for Completion Data
# ---------------------------
class LastPageDataIncoming(BaseModelNone):
    last_page_url: str  # = Field(None, alias="lastPageUrl") is the manual way
    course_id: str = Field(alias="course")
    completion_flag: int
    pageLoad: bool
    markingComplete: bool
    markingIncomplete: bool
    last_page_scroll_location: int
    is_ptx_book: bool
    model_config = ConfigDict(alias_generator=camelize)


class LastPageData(BaseModelNone):
    last_page_url: str
    course_name: str = Field(alias="course_id")
    completion_flag: int
    last_page_scroll_location: int
    last_page_chapter: str
    last_page_subchapter: str
    last_page_accessed_on: datetime
    user_id: int


class SelectQRequest(BaseModel):
    selector_id: str
    questions: Optional[str] = None
    proficiency: Optional[str] = None
    points: Optional[int] = None
    min_difficulty: Optional[float] = None
    max_difficulty: Optional[float] = None
    not_seen_ever: Optional[bool] = None
    autogradable: Optional[bool] = None
    primary: Optional[bool] = None
    AB: Optional[str] = None
    toggleOptions: Optional[str] = None
    timedWrapper: Optional[str] = None
    limitBaseCourse: Optional[str] = None


class PeerMessage(BaseModel):
    type: str
    sender: str
    message: str
    broadcast: bool
