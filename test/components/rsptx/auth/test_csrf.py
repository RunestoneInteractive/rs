"""Cross-site request forgery guard.

The auth cookie is SameSite=None in production, so the browser sends it with a
form another site submits to us. These tests pin down which of those requests
the guard turns away and which -- LTI launches, non-browser clients, anonymous
requests -- it must leave alone.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rsptx.auth.csrf import add_csrf_protection
from rsptx.auth.session import auth_manager
from rsptx.configuration import settings

COOKIE = {auth_manager.cookie_name: "atoken"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "load_balancer_host", "runestone.academy")
    app = FastAPI()

    @app.post("/auth/delete-account")
    async def delete_account():
        return {"deleted": True}

    @app.get("/auth/profile")
    async def profile():
        return {"ok": True}

    @app.post("/lti1p3/launch")
    async def launch():
        return {"launched": True}

    add_csrf_protection(app, exempt_paths=("/lti1p3/launch",))
    # Host header the way the proxy passes it through in production.
    return TestClient(app, base_url="https://runestone.academy")


def post(client, path="/auth/delete-account", cookies=COOKIE, **headers):
    client.cookies.clear()
    client.cookies.update(cookies)
    return client.post(path, headers=headers)


def test_cross_site_form_post_with_cookie_is_blocked(client):
    res = post(
        client, **{"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"}
    )
    assert res.status_code == 403


def test_cross_site_is_blocked_on_sec_fetch_site_alone(client):
    res = post(client, **{"Sec-Fetch-Site": "cross-site"})
    assert res.status_code == 403


def test_same_origin_post_is_allowed(client):
    res = post(
        client,
        **{"Sec-Fetch-Site": "same-origin", "Origin": "https://runestone.academy"},
    )
    assert res.status_code == 200


def test_author_subdomain_is_allowed(client):
    res = post(
        client,
        **{
            "Sec-Fetch-Site": "same-site",
            "Origin": "https://author.runestone.academy",
        },
    )
    assert res.status_code == 200


def test_same_site_outside_load_balancer_host_is_blocked(client, monkeypatch):
    # A university install has no LOAD_BALANCER_HOST; a sibling host on the same
    # registrable domain may be student web space.
    monkeypatch.setattr(settings, "load_balancer_host", "")
    res = post(
        client,
        **{"Sec-Fetch-Site": "same-site", "Origin": "https://people.runestone.academy"},
    )
    assert res.status_code == 403


def test_old_browser_falls_back_to_origin(client):
    assert post(client, Origin="https://evil.example").status_code == 403
    assert post(client, Origin="https://runestone.academy").status_code == 200


def test_null_origin_is_blocked(client):
    assert post(client, Origin="null").status_code == 403


def test_no_browser_headers_is_allowed(client):
    # Neither header: not a browser, so not CSRF.
    assert post(client).status_code == 200


def test_cross_site_without_cookie_is_allowed(client):
    res = post(client, cookies={}, **{"Sec-Fetch-Site": "cross-site"})
    assert res.status_code == 200


def test_safe_method_is_allowed(client):
    client.cookies.update(COOKIE)
    res = client.get("/auth/profile", headers={"Sec-Fetch-Site": "cross-site"})
    assert res.status_code == 200


def test_exempt_lti_launch_is_allowed(client):
    res = post(
        client,
        "/lti1p3/launch",
        **{"Sec-Fetch-Site": "cross-site", "Origin": "https://canvas.example.edu"},
    )
    assert res.status_code == 200
