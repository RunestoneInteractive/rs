"""Receiver for anonymous usage telemetry check-ins.

This endpoint runs on the central runestone.academy install and records a row
per known installation. It is intentionally unauthenticated (other installs
are not Runestone users) and intentionally **never** reads, stores, or logs the
caller's IP address -- the only location kept is the self-declared ``region``
in the payload.
"""

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from rsptx.db.crud import upsert_installation
from rsptx.logging import rslogger

router = APIRouter(
    prefix="/telemetry",
    tags=["telemetry"],
)


class CheckinPayload(BaseModel):
    """The anonymous check-in body. Extra/oversized fields are rejected."""

    instance_id: str = Field(min_length=1, max_length=36)
    version: str = Field(default="", max_length=64)
    region: str = Field(default="", max_length=128)
    institution: str = Field(default="", max_length=512)
    base_courses: List[str] = Field(default_factory=list, max_length=2000)
    course_count_bucket: str = Field(default="", max_length=32)
    student_count_bucket: str = Field(default="", max_length=32)


@router.post("/checkin")
async def checkin(payload: CheckinPayload):
    """Record an anonymous installation check-in.

    Upserts by ``instance_id``. Does not inspect the request's network info.
    """
    await upsert_installation(payload.dict())
    return {"ok": True}
