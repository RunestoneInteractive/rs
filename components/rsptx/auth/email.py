import httpx
from rsptx.configuration import settings
from rsptx.logging import rslogger


async def send_email(to: str, subject: str, text: str, html: str = "") -> bool:
    if not settings.mailgun_api_key or not settings.mailgun_domain:
        rslogger.warning("Mailgun not configured, skipping email to %s", to)
        return False
    data: dict = {
        "from": settings.email_from,
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
    return True
