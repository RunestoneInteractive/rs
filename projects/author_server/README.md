# Author Server Usage

## Build the project
Navigate to this folder (where the `pyproject.toml` file is)

Run:
``` shell
poetry build-project
```

## Build a docker image

``` shell
docker build -t myimage .
```

## Run the image directly

``` shell
docker run -p 8000:8000 myimage
```

## Run the image in daemon mode

``` shell
docker run -d --name mycontainer -p 8000:8000 myimage
```

The OpenAPI specification of this FastAPI app can now be accessed at http://localhost:8000/docs#

