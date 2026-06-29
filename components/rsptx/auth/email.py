import httpx
from rsptx.configuration import settings
from rsptx.logging import rslogger


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
