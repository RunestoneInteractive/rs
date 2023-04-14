Templates and Static Files
==========================

This is a common folder for all FastAPI applications. It contains the templates and static files that are used by the application.

The html files in the root of this folder are shared or inherited templates that are used by all applications.  For example ``_base.html`` is the base template for all html files.

Subdirectories of this folder represent and share names with the servers that use them.  For example ``assignment/`` contains the templates for the assignment server.

The staticAssets folder constains the css and javascript and images files used by each application.  It as a similar organization.  For example ``staticAssets/assignment/`` contains the css and javascript and images files used by the assignment server.  

The ``staticAssets/`` folder also contains the ``common/`` folder which contains the css and javascript and images files that are used by all applications.


The staticAssets folder is copied to the nginx server when the server is built.  The nginx server is configured to serve the static files from the ``/staticAssets/`` folder.

The staticAssets folder is also mounted locally for each app server for development purposes so that you do not need a running nginx server to develop the application.

.. code-block:: text

    ├── __init__.py
    ├── _base.html
    ├── assignment/
    │  └── student
    ├── author/
    │  ├── anonymize_data.html
    │  ├── editlibrary.html
    │  ├── home.html
    │  ├── impact.html
    │  ├── logfiles.html
    │  ├── notauthorized.html
    │  └── subchapmap.html
    ├── book/
    │  └── index.html
    ├── author
    ├── core.py
    ├── footer.html
    ├── README.rst
    └── staticAssets
        ├── assignment/
        ├── author/
        ├── book/
        ├── common/        
        ├── books.js
        ├── index.css
        ├── main.css
        ├── main.js
        └── RAIcon.png

