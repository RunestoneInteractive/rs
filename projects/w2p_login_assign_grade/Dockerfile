# pull official base image
FROM python:3.10-bullseye

LABEL org.opencontainers.image.source https://github.com/RunestoneInteractive/rs

# This is the name of the wheel that we build using `poetry build-project`
ARG wheel=w2p_login_assign_grade-7.0.0-py3-none-any.whl

# set work directory
WORKDIR /usr/src/app

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV WEB2PY_CONFIG development
ENV RUNESTONE_PATH /usr/src/app
ENV RUNESTONE_HOST localhost
# When docker is run the books volume can/will be mounted
ENV BOOK_PATH /usr/books
ENV SERVER_CONFIG development
ENV DEV_DBURL postgresql://runestone:runestone@host.docker.internal/runestone_dev
ENV CELERY_BROKER_URL=redis://redis:6379/0
ENV CELERY_RESULT_BACKEND=redis://redis:6379/0

# install dependencies
RUN pip install --upgrade pip

# copy project
COPY ./dist/$wheel /usr/src/app/$wheel
COPY entrypoint.sh /usr/src/app/entrypoint.sh

# When you pip install a wheel it also installs all of the dependencies
# which are stored in the METADATA file inside the wheel
RUN pip install --no-cache-dir --upgrade /usr/src/app/$wheel
RUN chown -R www-data:www-data /usr/local/lib/python3.10/site-packages/rsptx/web2py_server
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
# The default entrypoint is essentially /bin/bash
# The CMD is the default command which is passed as an argument to the entrypoint!
#CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "rsptx.web2py_server.wsgihandler:application"]
