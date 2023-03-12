## Readme

To run web2py you MUST have at least the following environment variables set up.

* WEB2PY_CONFIG -- one of production, development or test
* DBURL
* DEV_DBURL
* TEST_DBURL
* RUNESTONE_PATH - path to this web2py folder
* BOOK_PATH - path to a folder that holds the books.  This folder is mounted as a docker volume when running in docker.

Can run web2py in development mode easily by `python web2py.py`  Some commonly used options are demonstrated here:  `python web2py.py --no-gui --password "<recycle>" --interface 0.0.0.0:8080 `
It can be very useful to start up web2py as an interactive shell that is aware of the database models and runestone application with `python web2py.py --import_models --shell runestone`
The `--errors_to_console` may also be useful.

# But need to set up environment variables
sudo gunicorn --log-level DEBUG --bind 0.0.0.0:5001  --workers 1 --user bmiller --group www-data wsgihandler:application

# I'm not sure why but on macOS running gunicorn as bmiller causes trouble.  The workers all crash as soon as you make the first request.


Note -- We are phasing out web2py and have incorporated Version 2.23.1-stable as part of this base.  This would not prevent us from updating web2py in the future but makes it much simpler to build as part of a docker container.
