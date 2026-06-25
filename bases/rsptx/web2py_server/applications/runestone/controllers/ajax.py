# *************************
# |docname| - Runestone API
# *************************
# **Most of this file is Deprecated.**
# The endpoints that used to live here have moved to the BookServer and the
# assignment server. Only ``set_tz_offset()`` remains -- still posted to by some
# legacy web2py views to record the browser timezone offset in the session.
#
# Ported elsewhere:
#
# * ``getassignmentgrade()`` -> assignment server ``/assignment/student/getassignmentgrade``
# * ``broadcast_code()``     -> assignment server ``/assignment/instructor/broadcast_code``
#
# ``set_tz_offset`` also has a BookServer equivalent (``/ns/logger/set_tz_offset``,
# cookie based), but it can't be retired until the legacy web2py consumers of
# ``session.timezoneoffset`` (assignments.py, dashboard.py, admin.py practice) read
# the timezone from the ``RS_info`` cookie instead.
#
# If you are debugging browser-to-server API behavior you almost certainly want
# the BookServer, not this file.
#
# Imports
# =======
import logging

logger = logging.getLogger(settings.logger)
logger.setLevel(settings.log_level)
logger.propagate = False


def set_tz_offset():
    session.timezoneoffset = request.vars.timezoneoffset
    logger.debug("setting timezone offset in session %s hours" % session.timezoneoffset)
    return "done"
