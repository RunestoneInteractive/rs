# *********************************
# |docname| - Runestone Module init
# *********************************

from importlib.metadata import version, PackageNotFoundError


# Module variables
# ----------------
try:
    runestone_version = version("runestone")
except PackageNotFoundError:
    # runestone isn't installed (e.g. running from source); nothing to report.
    runestone_version = "unknown"
except Exception:
    # It is installed but the version couldn't be read for some other reason.
    print("Could not determine runestone version")
    runestone_version = "unknown"


cmap = {
}
