# Book Server Usage

## Build the project
Navigate to this folder (where the `pyproject.toml` file is)

Run:
``` shell
poetry build-project
```

## Build a docker image

``` shell
docker build -t bookserver .
```

## Run the image directly

``` shell
docker run  -p 8000:8000 -v/path/to/runestone/books:/usr/books bookserver
```
Notes:

1. The docker image is configured to connect to a postgresql database running on the host.  See the Dockerfile and the DEV_DBURL environment variable.
2. This mounts a volume that contains Runestone books that are already built.

## Run the image in daemon mode

``` shell
docker run -d -p 8000:8000 -v/path/to/runestone/books:/usr/books bookserver
```


