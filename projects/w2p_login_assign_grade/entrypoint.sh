#!/bin/bash

cd /usr/local/lib/python3.10/site-packages/rsptx/web2py_server
python web2py.py -S runestone -M -R tickets2db.py &
cd /usr/src/app
gunicorn --bind 0.0.0.0:8112 rsptx.web2py_server.wsgihandler:application