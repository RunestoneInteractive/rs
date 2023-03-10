*******
Routers
*******
:index:`docs to write`: More here...

Routers in FastAPI

Each API endpoint should return a ``JSONResponse`` as well as use the HTTP status code to
indicate success or failure of the operation.  The ``JSONResponse`` should ALWAYS include a
key named ``detail``; the value of detail may be the actual response or a message elaborating
on the response status code.   Endpoints may choose to add additional keys to the JSON object
or simply make the value of the detail key as complex as needed.

The `../internal/utils.py` file has a helper function called ``make_json_response`` to make this easy.
An empty call to ``make_json_response()`` will return result with a status code of 200 and a
detail of ``None``.

.. toctree::
    :maxdepth: 2

    assessment.py
    auth.py
    books.py
    discuss.py
    rslogging.py
