# pull official base image
FROM python:3.10-bullseye

# This is the name of the wheel that we build using `poetry build-project`
ARG wheel=author_server-0.1.0-py3-none-any.whl

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
RUN apt install -y --fix-missing git texlive-full xsltproc pdf2svg rsync sagemath
#RUN pip install -r requirements.txt
#RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python -
RUN pip install poetry

# copy project
COPY ./dist/$wheel /usr/src/app/$wheel
# When you pip install a wheel it also installs all of the dependencies
# which are stored in the METADATA file inside the wheel
RUN pip install --no-cache-dir --upgrade /usr/src/app/$wheel
COPY . .
#COPY .ssh/id_rsa .

CMD ["uvicorn", "rsptx.author_server_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
