# pull official base image
FROM python:3.10-bullseye

# This is the name of the wheel that we build using `poetry build-project`
ARG wheel=dash_server-0.1.0-py3-none-any.whl

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DEV_DBURL postgresql://runestone:runestone@host.docker.internal/runestone_dev

# install dependencies
RUN pip install --upgrade pip
RUN apt update


# copy project
COPY ./dist/$wheel /usr/src/app/$wheel
# When you pip install a wheel it also installs all of the dependencies
# which are stored in the METADATA file inside the wheel
RUN pip install --no-cache-dir --upgrade /usr/src/app/$wheel
#COPY . .
#COPY .ssh/id_rsa .

CMD ["gunicorn", "rsptx.dash_server_api.core:server", "--bind", "0.0.0.0:8000"]
