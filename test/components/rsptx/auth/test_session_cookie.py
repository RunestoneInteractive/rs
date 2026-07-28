"""Scoping of the auth cookie.

The author server runs on its own host in production, so a session started on
runestone.academy only reaches it if the cookie carries a Domain -- a Domain
attribute also matches subdomains. web2py has always scoped this cookie by
LOAD_BALANCER_HOST; the FastAPI side did not, which left instructors unable to
reach author tools (issue #606).
"""

import pytest
from starlette.responses import Response

from rsptx.auth.session import auth_manager
from rsptx.configuration import settings


def set_cookie_headers(response):
    """Every Set-Cookie header on a response, as a list of strings."""
    return [
        value.decode()
        for key, value in response.raw_headers
        if key.decode().lower() == "set-cookie"
    ]


@pytest.fixture
def load_balancer_host(monkeypatch):
    """Set (or clear) LOAD_BALANCER_HOST for the duration of a test."""

    def _set(host):
        monkeypatch.setattr(settings, "load_balancer_host", host)

    return _set


def test_cookie_is_host_only_without_a_load_balancer_host(load_balancer_host):
    # Local development: browsers reject a Domain of "localhost", so none is sent.
    load_balancer_host("")
    response = Response()

    auth_manager.set_cookie(response, "atoken")

    headers = set_cookie_headers(response)
    assert len(headers) == 1
    assert "domain" not in headers[0].lower()


def test_cookie_is_scoped_to_the_load_balancer_host(load_balancer_host):
    load_balancer_host("runestone.academy")
    response = Response()

    auth_manager.set_cookie(response, "atoken")

    scoped = [h for h in set_cookie_headers(response) if "atoken" in h]
    assert len(scoped) == 1
    assert "domain=runestone.academy" in scoped[0].lower()


def test_setting_a_scoped_cookie_expires_the_old_host_only_one(load_balancer_host):
    # Anyone logged in before this change still holds a host-only cookie of the
    # same name; the browser would keep both and send both.
    load_balancer_host("runestone.academy")
    response = Response()

    auth_manager.set_cookie(response, "atoken")

    headers = set_cookie_headers(response)
    assert len(headers) == 2
    expiry = [h for h in headers if "atoken" not in h]
    assert len(expiry) == 1
    assert "domain" not in expiry[0].lower()


def test_logout_clears_both_variants(load_balancer_host):
    # A Domain mismatch on delete is silent -- the browser keeps the cookie and
    # the user stays logged in -- so both have to be cleared.
    load_balancer_host("runestone.academy")
    response = Response()

    auth_manager.delete_cookie(response)

    headers = set_cookie_headers(response)
    assert len(headers) == 2
    assert any("domain=runestone.academy" in h.lower() for h in headers)
    assert any("domain" not in h.lower() for h in headers)


def test_logout_clears_a_host_only_cookie(load_balancer_host):
    load_balancer_host("")
    response = Response()

    auth_manager.delete_cookie(response)

    headers = set_cookie_headers(response)
    assert len(headers) == 1
    assert "domain" not in headers[0].lower()


def test_cookie_name_is_shared_with_web2py():
    # web2py writes the same cookie in models/db.py; if these ever diverge the
    # two servers stop recognising each other's sessions.
    assert auth_manager.cookie_name == "access_token"
