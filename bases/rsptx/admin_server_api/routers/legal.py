"""
legal.py - Public legal & compliance pages for the admin server.

Ports the privacy policy, terms of service, security plan (WISP), advertising
explainer, and state addenda from the old web2py ``default`` controller, and
adds an Accessibility (VPAT) page.  Everything is grouped under a single
"Legal & Compliance" hub at ``/admin/legal`` so the documents are easy to find
and cite (procurement, LMS review, etc.).

These routes are intentionally public: they must render for logged-out
visitors and crawlers, so none of them depend on ``auth_manager``.
"""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from rsptx.templates import template_folder

router = APIRouter(
    prefix="/legal",
    tags=["legal"],
)

templates = Jinja2Templates(directory=template_folder)

# ---------------------------------------------------------------------------
# Document registry
# ---------------------------------------------------------------------------
# Single source of truth for the hub cards and each page's header metadata.
# ``updated`` is the human-readable "Last updated" date shown on the page.
# ``hub`` controls whether the doc appears as a primary card on the hub.

LEGAL_DOCS = {
    "privacy": {
        "title": "Privacy Policy",
        "updated": "July 2026",
        "template": "legal/privacy.html",
        "blurb": "What data we collect, how we use and protect it, and your "
        "rights (COPPA, GDPR, CCPA, data retention and deletion).",
        "hub": True,
    },
    "terms": {
        "title": "Terms of Service",
        "updated": "August 16, 2019",
        "template": "legal/terms.html",
        "blurb": "The terms and conditions governing your use of Runestone "
        "Academy, including licensing, content rules, and liability.",
        "hub": True,
    },
    "security": {
        "title": "Data Security & Privacy Plan",
        "updated": "August 2025",
        "template": "legal/security.html",
        "blurb": "Our administrative, technical, and operational safeguards for "
        "protecting data, incident response, and alignment with the NIST "
        "Cybersecurity Framework.",
        "hub": True,
    },
    "accessibility": {
        "title": "Accessibility & VPAT",
        "updated": "January 2026",
        "template": "legal/accessibility.html",
        "blurb": "Our commitment to accessibility and our WCAG 2.1 AA "
        "Voluntary Product Accessibility Template (VPAT/ACR).",
        "hub": True,
        # Downloadable VPAT/ACR, served from the shared staticAssets.
        "extra": {"vpat_url": "/staticAssets/docs/runestone-vpat.pdf"},
    },
    "ads": {
        "title": "About Advertising",
        "updated": None,
        "template": "legal/ads.html",
        "blurb": "Why you may see ads, and how registered students never do.",
        "hub": False,
    },
    "ct_addendum": {
        "title": "Terms Addendum — Connecticut",
        "updated": None,
        "template": "legal/ct_addendum.html",
        "blurb": "Additional terms for schools in Connecticut "
        "(Conn. Gen. Stat. §§ 10-234aa–10-234dd).",
        "hub": False,
    },
    "ca_addendum": {
        "title": "Additional Information for California Residents",
        "updated": None,
        "template": "legal/ca_addendum.html",
        "blurb": "CCPA rights and disclosures for California consumers.",
        "hub": False,
    },
}


def _render(request: Request, key: str) -> HTMLResponse:
    doc = LEGAL_DOCS[key]
    context = {
        "request": request,
        "page_title": doc["title"],
        "updated": doc["updated"],
    }
    context.update(doc.get("extra", {}))
    return templates.TemplateResponse(doc["template"], context)


# ---------------------------------------------------------------------------
# Hub
# ---------------------------------------------------------------------------


@router.get("", response_class=HTMLResponse)
@router.get("/", response_class=HTMLResponse)
async def legal_hub(request: Request):
    """Trust-center style landing page linking to every legal document."""
    cards = [{"key": key, **doc} for key, doc in LEGAL_DOCS.items() if doc["hub"]]
    return templates.TemplateResponse(
        "legal/hub.html",
        {
            "request": request,
            "page_title": "Legal & Compliance",
            "cards": cards,
        },
    )


# ---------------------------------------------------------------------------
# Individual documents
# ---------------------------------------------------------------------------


@router.get("/privacy", response_class=HTMLResponse)
async def privacy(request: Request):
    return _render(request, "privacy")


@router.get("/terms", response_class=HTMLResponse)
async def terms(request: Request):
    return _render(request, "terms")


@router.get("/security", response_class=HTMLResponse)
async def security(request: Request):
    return _render(request, "security")


@router.get("/accessibility", response_class=HTMLResponse)
async def accessibility(request: Request):
    return _render(request, "accessibility")


@router.get("/ads", response_class=HTMLResponse)
async def ads(request: Request):
    return _render(request, "ads")


@router.get("/ct_addendum", response_class=HTMLResponse)
async def ct_addendum(request: Request):
    return _render(request, "ct_addendum")


@router.get("/ca_addendum", response_class=HTMLResponse)
async def ca_addendum(request: Request):
    return _render(request, "ca_addendum")
