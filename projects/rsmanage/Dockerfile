# pull official base image
FROM python:3.13 AS builder

LABEL org.opencontainers.image.source https://github.com/RunestoneInteractive/rs

# This is the name of the wheel that we build using `poetry build-project`
ARG wheel=rsmanage-2.0.1-py3-none-any.whl

# This demonstrates how to use a build argument to install texlive see https://stackoverflow.com/questions/34322631/how-to-pass-arguments-within-docker-compose for more info
# The docker-compose file can also be updated to use a build object with args.  See https://docs.docker.com/compose/compose-file/#args
# The docker-compose file would look like this:
# build:
#   context: .
#   args:
#     texlive: 1
# The docker-compose command would look like this:

# This is meant to be run
# docker compose run rsmanage

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DEV_DBURL postgresql://runestone:runestone@host.docker.internal/runestone_dev

# The Runestone release version, baked in at build time so rsmanage telemetry
# reports the same version this image is tagged with.
ARG runestone_version=unknown
ENV RUNESTONE_VERSION=${runestone_version}

# install dependencies
RUN pip install --upgrade pip
RUN apt update
RUN apt install -y rsync
RUN apt install -y --no-install-recommends libpq-dev
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs

# copy project
COPY ./projects/rsmanage/dist/$wheel /usr/src/app/$wheel
COPY ./alembic.ini /usr/src/app/alembic.ini
COPY ./migrations /usr/src/app/migrations
COPY ./components/rsptx/build_tools/check-db-migrations.sh /usr/local/bin/check-db-migrations.sh
# When you pip install a wheel it also installs all of the dependencies
# which are stored in the METADATA file inside the wheel
RUN pip install --no-cache-dir --upgrade /usr/src/app/$wheel
RUN pip install --no-cache-dir --upgrade alembic
RUN git config --global --add safe.directory '*'

