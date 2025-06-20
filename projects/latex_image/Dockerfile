# pull official base image
FROM python:3.13-bullseye

LABEL org.opencontainers.image.source https://github.com/RunestoneInteractive/latex_image
LABEL importance="high"

# install dependencies
RUN pip install --upgrade pip
RUN apt update

RUN apt update && apt install -y  \
    texlive \
    texlive-science \
    texlive-xetex \
    texlive-fonts-extra \
    ghostscript \
    xsltproc \
    pdf2svg \
    sagemath 
