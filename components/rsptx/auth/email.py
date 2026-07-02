import httpx
import mistune
from jinja2 import Template

from rsptx.configuration import settings
from rsptx.logging import rslogger
from rsptx.templates import template_folder


async def send_email(to: str, subject: str, text: str, html: str = "") -> bool:
    """
    Send an email using Mailgun.

    Args:
        to (str): Recipient email address.
        subject (str): Subject of the email.
        text (str): Plain text content of the email.
        html (str, optional): HTML content of the email. Defaults to "".

        You need to have a valid Sending API key configured in the settings for the domain
        you have set up on Mailgun (Sinch)

    Returns:
        bool: True if the email was sent successfully, False otherwise.
    """
    if not settings.mailgun_api_key or not settings.mailgun_domain:
        rslogger.warning("Mailgun not configured, skipping email to %s", to)
        return False
    data: dict = {
        "from": settings.email_sender,
        "to": to,
        "subject": subject,
        "text": text,
    }
    if html:
        data["html"] = html
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.mailgun.net/v3/{settings.mailgun_domain}/messages",
            auth=("api", settings.mailgun_api_key),
            data=data,
        )
    if resp.status_code != 200:
        rslogger.error("Mailgun error %s: %s", resp.status_code, resp.text)
        return False
    rslogger.info("Mailgun sent email to %s About %s", to, subject)
    return True


async def send_welcome_email(
    to: str,
    course_name: str,
    course_url: str,
    social_url: str = "",
    invoice_url: str = "",
) -> bool:
    """
    Send the "Welcome to Runestone Academy" email to a new instructor.

    Renders the markdown template at ``templates/emails/welcome_email.md`` with the
    supplied course details, converts it to HTML, and sends both a plain text and an
    HTML version via :func:`send_email`.

    Args:
        to (str): The instructor's email address.
        course_name (str): The name of the newly created course.
        course_url (str): A link the instructor can follow to open the course.
        social_url (str, optional): Link to the book's instructor Google group. When
            empty the community group paragraph is omitted from the email.
        invoice_url (str, optional): Link to the invoice request page. When empty,
            the invoice paragraph is omitted from the email.

    Returns:
        bool: True if the email was sent successfully, False otherwise.
    """
    template_path = template_folder / "emails" / "welcome_email.md"
    try:
        raw = template_path.read_text(encoding="utf-8")
    except OSError as e:
        rslogger.error("Could not read welcome email template: %s", e)
        return False

    body_md = Template(raw).render(
        course_name=course_name,
        course_url=course_url,
        social_url=social_url or "",
        invoice_url=invoice_url or "",
    )

    # The first line of the template holds the subject; split it from the body.
    subject = "Welcome to Runestone Academy"
    first_line, _, remainder = body_md.partition("\n")
    if first_line.lower().startswith("subject:"):
        subject = first_line.split(":", 1)[1].strip()
        body_md = remainder.lstrip("\n")

    body_html = mistune.html(body_md)
    return await send_email(to=to, subject=subject, text=body_md, html=body_html)
