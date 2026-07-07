from pathlib import Path

import jinja2
from fastapi.templating import Jinja2Templates


def get_jinja_templates(book_path: str) -> Jinja2Templates:
    """Return Jinja templates that search book-specific and shared paths."""
    template_folder = Path(__file__).parent.absolute()
    loader = jinja2.ChoiceLoader(
        [
            jinja2.FileSystemLoader(book_path),
            jinja2.FileSystemLoader(template_folder),
        ]
    )
    env = jinja2.Environment(
        loader=loader,
        autoescape=jinja2.select_autoescape(["html", "xml"]),
    )
    return Jinja2Templates(env=env)
