#!/usr/bin/env python

import subprocess
from rsptx.cl_utils.core import pushd
import toml

project = toml.load("pyproject.toml")
VERSION = project["tool"]["poetry"]["version"]


with pushd("../../bases/rsptx/interactives"):
    subprocess.run(["npm", "run", "dist"], check=True)
    subprocess.run(["python", "./scripts/dist2xml.py", f"{VERSION}"], check=True)


subprocess.run(["poetry", "build-project"], check=True)
