import requests

# see https://documentation.mailgun.com/en/latest/api-sending.html#sending
# The mailgun API_KEY will come from and environment variable


def send_email_with_template(api_key, domain, to, subject, template):
    """Send an email with the mailgun API using a template

    :param api_key: mg API key
    :type api_key: str
    :param domain: The domain you set up on mailgun
    :type domain: str
    :param to: either a single user or the name of a mailing list
    :type to: str
    :param subject: email subject line
    :type subject: str
    :param template: the name of the template you created on mailgun
    :type template: str
    :return: requests response object
    :rtype: dict
    """
    return requests.post(
        "https://api.mailgun.net/v3/{}/messages".format(domain),
        auth=("api", api_key),
        data={
            "from": "Runestone Academy <mailgun@{}>".format(domain),
            "to": to,
            "subject": subject,
            "template": template,
        },
    )


def send_email_with_text(api_key, domain, to, subject, text):
    return requests.post(
        "https://api.mailgun.net/v3/{}/messages".format(domain),
        auth=("api", api_key),
        data={
            "from": "Runestone Academy <mailgun@{}>".format(domain),
            "to": to,
            "subject": subject,
            "text": text,
        },
    )


# See https://documentation.mailgun.com/en/latest/api-mailinglists.html#mailing-lists
def add_list_member(api_key, listaddr, name, email):
    return requests.post(
        f"https://api.mailgun.net/v3/lists/{listaddr}/members",
        auth=("api", api_key),
        data={
            "subscribed": True,
            "address": email,
            "name": name,
        },
    )
