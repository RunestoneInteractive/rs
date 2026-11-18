"""The site navbar and footer rendered around the dash pages."""

from flask import Flask, g

from rsptx.dash_server_api.auth import CourseContext
from rsptx.dash_server_api.shell import render_footer, render_navbar


def _render(context, render=render_navbar):
    app = Flask(__name__)
    with app.test_request_context("/dash/"):
        if context is not None:
            g.rs_context = context
        return render()


def test_navbar_is_the_instructors():
    html = _render(CourseContext("teach<er>", 1, "my_course", "thinkcspy"))
    assert "logged in: teach&lt;er&gt;" in html  # escaped, not raw
    assert "/ns/books/published/my_course/index.html" in html
    assert "Instructor Dashboard" in html


def test_footer_is_the_sites():
    html = _render(CourseContext("teacher", 1, "my_course", "thinkcspy"), render_footer)
    assert "/admin/legal/privacy" in html
    assert "<strong>teacher</strong>" in html


def test_no_shell_without_a_login():
    assert _render(None) == ""
    assert _render(None, render_footer) == ""
