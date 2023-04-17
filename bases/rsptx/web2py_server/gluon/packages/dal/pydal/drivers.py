# -*- coding: utf-8 -*-

DRIVERS = {}

from ._gae import gae

if gae is not None:
    DRIVERS["google"] = gae
    psycopg2_adapt = None
    cx_Oracle = None
    pyodbc = None
    couchdb = None
    is_jdbc = False

is_jdbc = False

try:
    from sqlite3 import dbapi2 as sqlite3

    DRIVERS["sqlite3"] = sqlite3
except ImportError:
    pass


try:
    import psycopg2
    from psycopg2.extensions import adapt as psycopg2_adapt

    DRIVERS["psycopg2"] = psycopg2
except ImportError:
    psycopg2_adapt = None


try:
    import imaplib

    DRIVERS["imaplib"] = imaplib
except:
    pass
