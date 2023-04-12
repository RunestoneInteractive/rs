#!/bin/bash

# Make sure the wheel for this project is up to date
poetry build-project

# Build the Docker image
docker build -t assignment .