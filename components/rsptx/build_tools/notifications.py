# notifications.py
# Pushover is a service that allows you to send notifications to your devices.
# This module provides a simple interface to send notifications using the Pushover API.
# We use environment variables to store the Pushover user key and app token for security reasons.
# Pushover is used for building notifications in the buildptx.py script. If the build fails or
# finishes with errors, a notification will be sent to the user.
# It is also used for deployment notifications in the deploy_all.sh script. If the deployment fails
# or finishes with errors, a notification will be sent to the user.
# I also use it in my monitoring scripts to notify me of an excessive number of errorrs in the logs.
# It is useful for iOS and Android users.

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
