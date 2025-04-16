# *******************************************
# |docname| - Additional web2py configuration
# *******************************************
#
import os


# ===================================================
# LTI Options
# ===================================================

# for LTI to work properly in a modern multi server configuration we need to set the `lti_uri`
settings.lti_interface = True
if "LOAD_BALANCER_HOST" not in os.environ or os.environ["LOAD_BALANCER_HOST"] == "":
    settings.lti_uri = f"https://{os.environ.get('RUNESTONE_HOST')}/runestone/lti"
else:
    settings.lti_uri = f"https://{os.environ['LOAD_BALANCER_HOST']}/runestone/lti"


# ===================================================
# Course/User Options
# ===================================================

settings.default_course = "fopp"

# Enable captchas during registration
# settings.enable_captchas = True

# This allows you to use "standard" courses as an instructor. Runestone.academy does not let
# people be instructors for the default courses like "thinkcpy"
settings.docker_institution_mode = True


# ===================================================
# Jobe Options
# ===================================================

# Set location of jobe code compilation server
settings.jobe_server = "http://jobe"
settings.jobe_key = ""


# ===================================================
# Other Server Options
# ===================================================
if "EMAIL_SERVER" in os.environ:
    settings.email_server = os.environ["EMAIL_SERVER"]
if "EMAIL_SENDER" in os.environ:
    settings.email_sender = os.environ["EMAIL_SENDER"]
if "EMAIL_LOGIN" in os.environ:
    settings.email_login = os.environ["EMAIL_LOGIN"]

# Google Analytics id
settings.google_ga = "UA-XXX-XX"

# For compatibility with the new book server set a secret key value here.
settings.jwt_secret = os.environ.get("JWT_SECRET", "supersecret")

# This must point to a valid python interpreter to use the web interface for question authoring. TODO: this is no longer necessary since we're not using uwsgi to run web2py.
# settings.python_interpreter = f"{os.environ['RUNESTONE_PATH']}/.venv/bin/python3"
settings.python_interpreter = "python3"

# to work with a websocket server (FastAPI based) for peer instruction chat
# settings.websocket_url = "ws://dev.runestoneinteractive.org/ns"
# for https servers
# settings.websocket_url = "wss://dev.runestoneinteractive.org/ns"

if (
    "LOAD_BALANCER_HOST" in os.environ and os.environ["LOAD_BALANCER_HOST"] == ""
):  # dev or single server
    settings.websocket_url = f"ws{'s' if os.environ.get('CERTBOT_EMAIL', False) else ''}://{os.environ['RUNESTONE_HOST']}/ns"
elif (
    "LOAD_BALANCER_HOST" in os.environ and os.environ["LOAD_BALANCER_HOST"] != ""
):  # production with load balancer
    settings.websocket_url = f"wss://{os.environ['LOAD_BALANCER_HOST']}/ns"
else:  # single or no load balancer with adjusted docker-compose file
    settings.websocket_url = f"ws{'s' if os.environ.get('CERTBOT_EMAIL', False) else ''}://{os.environ['RUNESTONE_HOST']}/ns"


# Define the path used to route to the BookServer.
settings.bks = "ns"

# Define the URL for the author server pages
settings.author_server = "/author/home"
settings.canonical_server = "https://runestone.academy"

settings.bucket = "runestonefiles"
settings.spaces_key = os.environ.get("SPACES_KEY", "")
settings.spaces_secret = os.environ.get("SPACES_SECRET", "")
settings.region = "nyc3"

settings.use_master_author = os.environ.get("USE_MASTER_AUTHOR", False)
if settings.use_master_author == "False":
    settings.use_master_author = False
elif settings.use_master_author == "True":
    settings.use_master_author = True