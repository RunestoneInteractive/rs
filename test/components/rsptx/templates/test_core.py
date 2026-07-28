from types import SimpleNamespace

import pytest

from rsptx.templates import core


def test_sample():
    assert core is not None


@pytest.mark.parametrize(
    ("github_url", "expected"),
    [
        (
            "https://github.com/RunestoneInteractive/thinkcspy",
            "https://github.com/RunestoneInteractive/thinkcspy",
        ),
        (None, "No GitHub repository is recorded for this book."),
    ],
)
def test_editlibrary_displays_source_repository(github_url, expected):
    templates = core.get_jinja_templates("")
    template = templates.env.get_template("author/editlibrary.html")

    rendered = template.render(
        form=[],
        book="thinkcspy",
        course=SimpleNamespace(course_name="thinkcspy"),
        github_url=github_url,
    )

    assert expected in rendered
