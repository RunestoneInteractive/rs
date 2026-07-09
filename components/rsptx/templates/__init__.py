from pathlib import Path
from rsptx.templates import core
from rsptx.templates.core import get_jinja_templates

__all__ = ["core", "get_jinja_templates", "template_folder"]

template_folder = Path(__file__).parent.absolute()
