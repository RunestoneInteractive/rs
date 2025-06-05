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

COPY --from=builder /usr/local /usr/local

CMD ["uvicorn", "rsptx.book_server_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
