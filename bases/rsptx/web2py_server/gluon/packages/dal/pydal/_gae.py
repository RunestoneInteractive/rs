# -*- coding: utf-8 -*-

try:
    from new import classobj
except ImportError:
    classobj = type

try:
    from google.appengine.ext import db as gae
except ImportError:
    gae = None
    Key = None
else:
    pass
