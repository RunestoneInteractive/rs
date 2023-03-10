# The Student Dashboard Interface

This server is based on plotly and dash.  Which build on top of flask for providing
some pretty amazing dashboard functionality without having to write html, javascript, or CSS.  It works with Celery in the background so that if you parts of the dashboard that may take some time to compute, it all still works and you don't have to mess around with tasks or task scheduling or what have you.

# To build a wheel
```bash
poetry build-project
```

# To build a docker image

```bash
docker build -t dashserver .
```

# To run with gunicorn

#This is useful for rapid development when you don't need other servers as dependencies

```bash
poetry shell
gunicorn rsptx.dash_server_api.core:server --reload
```

