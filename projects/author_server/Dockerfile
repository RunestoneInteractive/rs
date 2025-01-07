# pull official base image
#FROM python:3.10-bullseye
FROM latex_base:latest

LABEL org.opencontainers.image.source https://github.com/RunestoneInteractive/rs

# This is the name of the wheel that we build using `poetry build-project`
ARG wheel=author_server-1.0.0-py3-none-any.whl

# This demonstrates how to use a build argument to install texlive see https://stackoverflow.com/questions/34322631/how-to-pass-arguments-within-docker-compose for more info
# The docker-compose file can also be updated to use a build object with args.  See https://docs.docker.com/compose/compose-file/#args
# The docker-compose file would look like this:
# build:
#   context: .
#   args:
#     texlive: 1
# The docker-compose command would look like this:
# docker-compose build --build-arg texlive=1
ARG texlive=1

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DEV_DBURL postgresql://runestone:runestone@host.docker.internal/runestone_dev
ENV CELERY_BROKER_URL=redis://redis:6379/0
ENV CELERY_RESULT_BACKEND=redis://redis:6379/0

# install dependencies
RUN pip install --upgrade pip
RUN apt update
RUN apt install -y rsync
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs


# copy project
COPY ./dist/$wheel /usr/src/app/$wheel
# When you pip install a wheel it also installs all of the dependencies
# which are stored in the METADATA file inside the wheel
RUN pip install --no-cache-dir --upgrade /usr/src/app/$wheel

COPY gitconfig /root/.gitconfig
#COPY .ssh/id_rsa .

CMD ["uvicorn", "rsptx.author_server_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
