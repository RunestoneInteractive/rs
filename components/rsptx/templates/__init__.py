from pathlib import Path
from rsptx.templates import core
from rsptx.templates.core import (
    format_course_datetime,
    get_jinja_templates,
    get_shared_templates,
    install_filters,
)

__all__ = [
    "core",
    "format_course_datetime",
    "get_jinja_templates",
    "get_shared_templates",
    "install_filters",
    "template_folder",
]

template_folder = Path(__file__).parent.absolute()
