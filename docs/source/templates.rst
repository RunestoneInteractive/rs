Templates
=========

Each service may have a folder heirarchy for the Jinja2 templates used in the user interface.

In addition the template component has a common folder ``staticAssets`` for static assets such as images, css and javascript.
The static assets are copied to a static folder in the nginx service during the build process so that nginx can serve them.

