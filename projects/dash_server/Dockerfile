# pull official base image
FROM python:3.13-slim AS builder

LABEL org.opencontainers.image.source https://github.com/RunestoneInteractive/rs

# This is the name of the wheel that we build using `uv build`
ARG wheel=dash_server-0.2.0-py3-none-any.whl

WORKDIR /usr/src/app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN pip install --upgrade pip

# When you pip install a wheel it also installs all of the dependencies
# which are stored in the METADATA file inside the wheel
COPY ./dist/$wheel /usr/src/app/$wheel
RUN pip install --no-cache-dir --upgrade /usr/src/app/$wheel
RUN rm /usr/src/app/$wheel

FROM python:3.13-slim
WORKDIR /usr/src/app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV RUNESTONE_PATH=/usr/src/app
ENV SERVER_CONFIG=development
# Note: host.docker.internal refers back to the host so we can just use a local instance
# of postgresql
ENV DEV_DBURL=postgresql://runestone:runestone@host.docker.internal/runestone_dev
ENV CELERY_BROKER_URL=redis://redis:6379/0
ENV CELERY_RESULT_BACKEND=redis://redis:6379/0

COPY --from=builder /usr/local /usr/local

# The same image runs the Celery worker for background callbacks; see the
# dash_worker service in docker-compose.yml.
CMD ["gunicorn", "rsptx.dash_server_api.core:server", "--bind", "0.0.0.0:8116", "--workers", "2"]
