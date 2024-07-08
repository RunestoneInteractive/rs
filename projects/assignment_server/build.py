#!/usr/bin/env python

import subprocess
import sys
from rsptx.cl_utils.core import pushd
import toml

project = toml.load("pyproject.toml")


with pushd("../../bases/rsptx/assignment_server_api/assignment_builder"):
    subprocess.run(["npm", "install"], check=True)
    subprocess.run(["npm", "run", "build"], check=True)

if "--fromroot" not in sys.argv:
    subprocess.run(["poetry", "build-project"], check=True)
