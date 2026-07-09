# pull official base image
FROM python:3.13-slim AS builder

LABEL org.opencontainers.image.source https://github.com/RunestoneInteractive/rs

# This is the name of the wheel that we build using `poetry build-project`
ARG wheel=book_server-2.0.1-py3-none-any.whl

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV RUNESTONE_PATH /usr/src/app
# When docker is run the books volume can/will be mounted
ENV BOOK_PATH /usr/books
ENV SERVER_CONFIG development
# Note: host.docker.internal refers back to the host so we can just use a local instance
# of postgresql
ENV DEV_DBURL postgresql://runestone:runestone@host.docker.internal/runestone_dev
ENV CELERY_BROKER_URL=redis://redis:6379/0
ENV CELERY_RESULT_BACKEND=redis://redis:6379/0

RUN echo 'export PS1="\[\e[1;32m\]\u@\h:\[\e[1;34m\]\w \[\e[0m\]\$ "' >> ~/.bashrc
# install dependencies
RUN pip install --upgrade pip
RUN apt update
RUN apt install -y gcc python3-dev

# copy project
COPY ./dist/$wheel /usr/src/app/$wheel
# When you pip install a wheel it also installs all of the dependencies
# which are stored in the METADATA file inside the wheel
RUN pip install --no-cache-dir --upgrade /usr/src/app/$wheel
RUN rm /usr/src/app/$wheel

FROM python:3.13-slim
WORKDIR /usr/src/app

# The Runestone release version, baked in at build time so the server can
# report it (e.g. in telemetry). Matches the tag applied to this image.
ARG runestone_version=unknown
ENV RUNESTONE_VERSION=${runestone_version}

# Minimum docker-compose.yml schema version this image requires. The compose
# `preflight` service runs check_compose_version.sh to compare this against the
# file's declared COMPOSE_SCHEMA_VERSION and refuses to start the stack if the
# user's docker-compose.yml is older. BUMP THIS (and COMPOSE_SCHEMA_VERSION in
# docker-compose.yml) whenever the compose file changes in a way newer images
# rely on.
ENV REQUIRED_COMPOSE_SCHEMA_VERSION=1

COPY --from=builder /usr/local /usr/local
COPY ./check_compose_version.sh /usr/local/bin/check_compose_version.sh
RUN chmod +x /usr/local/bin/check_compose_version.sh

CMD ["uvicorn", "rsptx.book_server_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
