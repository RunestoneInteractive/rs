#!/bin/bash

# This is a script to build the project and all of its dependencies.
# First we need to rebuild the wheels for each python project
# Then we need to build the docker images


echo "Building projects"
for proj in $(ls projects); do
    cd projects/$proj
    echo "Project: $proj"
    if [ -f "pyproject.toml" ]; then
        poetry build-project
    fi
    cd ../..
done

echo "Building docker images"
docker compose build

