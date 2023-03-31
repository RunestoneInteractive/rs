#!/bin/bash

# exit if any command has a non-zero exit status
set -e

echo "Starting Apache in the background"
/usr/sbin/apache2ctl -D BACKGROUND

echo "Start testsubmit.py as user www-data"
su -s /bin/bash -c "/usr/bin/python3 /var/www/html/jobe/testsubmit.py" www-data
