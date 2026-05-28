# notifications.py

import requests
import os

USER_KEY = os.environ.get("PUSHOVER_USER_KEY", None)
APP_TOKEN = os.environ.get("PUSHOVER_APP_TOKEN", None)


def notify(title, message, priority=0):
    if not USER_KEY or not APP_TOKEN:
        print(
            "Pushover credentials not set, skipping notification (see pushover.net for setup instructions)"
        )
        return
    requests.post(
        "https://api.pushover.net/1/messages.json",
        data={
            "token": APP_TOKEN,
            "user": USER_KEY,
            "title": title,
            "message": message,
            "priority": priority,
        },
        timeout=10,
    ).raise_for_status()
