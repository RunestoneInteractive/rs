# *********************************
# |docname| - Runestone Module init
# *********************************

from importlib.metadata import version


# Module variables
# ----------------
try:
    runestone_version = version("runestone")
except:
    print("Could not determine runestone version")
    runestone_version = "unknown"


cmap = {
}
