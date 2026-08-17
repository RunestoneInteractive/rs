"""
Tests for the /echoform form-echo endpoint.

The endpoint touches neither the database nor the auth manager, so these tests
mount the router on a bare FastAPI app instead of using the full server
fixtures.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rsptx.assignment_server_api.routers import echoform


@pytest.fixture(scope="module")
def client():
    app = FastAPI()
    app.include_router(echoform.router)
    with TestClient(app) as tc:
        yield tc


def test_get_with_no_params(client):
    res = client.get("/echoform")
    assert res.status_code == 200
    assert "<h1>Your Form Data</h1>" in res.text
    assert "submitted using the GET method" in res.text
    # CGI::Dump renders an empty list when there are no parameters.
    assert "<ul></ul>" in res.text


def test_get_query_params_are_dumped(client):
    res = client.get("/echoform?color=red&color=blue&name=Bob")
    assert "<li><strong>color</strong></li>" in res.text
    assert "<li>red</li>" in res.text
    assert "<li>blue</li>" in res.text
    assert "<li><strong>name</strong></li>" in res.text
    assert "<li>Bob</li>" in res.text


def test_post_urlencoded(client):
    res = client.post("/echoform", data={"who": "Alice", "why": "because"})
    assert "submitted using the POST method" in res.text
    assert "<li><strong>who</strong></li>" in res.text
    assert "<li>Alice</li>" in res.text


def test_post_merges_query_string(client):
    res = client.post("/echoform?extra=1", data={"who": "Alice"})
    assert "<li><strong>extra</strong></li>" in res.text
    assert "<li><strong>who</strong></li>" in res.text


def test_multipart_upload_is_described_not_echoed(client):
    res = client.post(
        "/echoform",
        data={"caption": "my file"},
        files={"upload": ("hello.txt", b"secret bytes", "text/plain")},
    )
    assert "<li>my file</li>" in res.text
    assert "file upload: hello.txt" in res.text
    assert "12 bytes" in res.text
    assert "secret bytes" not in res.text


def test_values_are_html_escaped(client):
    res = client.get("/echoform?x=%3Cscript%3Ealert(1)%3C/script%3E")
    assert "<script>alert(1)</script>" not in res.text
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in res.text


def test_names_are_html_escaped(client):
    res = client.get("/echoform?%3Cimg+src%3Dx+onerror%3Dalert(1)%3E=1")
    assert "<img" not in res.text
    assert "&lt;img" in res.text


def test_header_values_are_escaped(client):
    res = client.get(
        "/echoform",
        headers={
            "referer": "http://x/<script>alert(1)</script>",
            "host": "<b>evil</b>.example",
        },
    )
    assert "<script>" not in res.text
    assert "<b>evil</b>" not in res.text


def test_newlines_become_breaks(client):
    res = client.post("/echoform", data={"note": "line one\nline two"})
    assert "line one<br />" in res.text


def test_security_headers_present(client):
    res = client.get("/echoform")
    assert "sandbox" in res.headers["content-security-policy"]
    # Framable from our own origin (activecode output frames), nowhere else.
    assert "frame-ancestors 'self'" in res.headers["content-security-policy"]
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "SAMEORIGIN"
    assert res.headers["cache-control"] == "no-store"


def test_forged_x_forwarded_for_is_ignored(client):
    res = client.get("/echoform", headers={"x-forwarded-for": "not-an-ip"})
    assert "not-an-ip" not in res.text
    # Falls back to the real peer address reported by the transport.
    assert "submitted from" in res.text


def test_x_forwarded_for_uses_last_entry(client):
    res = client.get("/echoform", headers={"x-forwarded-for": "1.2.3.4, 5.6.7.8"})
    assert "submitted from 5.6.7.8" in res.text


def test_oversized_body_is_rejected(client):
    big = "x" * (echoform.MAX_BODY_BYTES + 100)
    res = client.post("/echoform", data={"blob": big})
    assert res.status_code == 413
    assert "too large" in res.text


def test_long_values_are_truncated(client):
    long_value = "y" * (echoform.MAX_VALUE_CHARS + 500)
    res = client.post("/echoform", data={"blob": long_value})
    assert res.status_code == 200
    assert "...[truncated]" in res.text
    assert long_value not in res.text


def test_too_many_fields_are_capped(client):
    data = {f"f{i}": "v" for i in range(echoform.MAX_FIELDS + 10)}
    res = client.post("/echoform", data=data)
    assert res.status_code == 200
    assert "more fields not shown" in res.text


def test_other_methods_rejected(client):
    assert client.put("/echoform").status_code == 405
    assert client.delete("/echoform").status_code == 405


def test_json_body_reports_no_params(client):
    res = client.post("/echoform", json={"a": 1})
    assert res.status_code == 200
    assert "<ul></ul>" in res.text
