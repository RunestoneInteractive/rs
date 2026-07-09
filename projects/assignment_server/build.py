#!/usr/bin/env python

import subprocess
import sys
from rsptx.cl_utils.core import pushd
import toml
import os

project = toml.load("pyproject.toml")


dist_path = "../../bases/rsptx/interactives/runestone/dist"
if not os.path.exists(dist_path):
    print(f"Error: {dist_path} does not exist. Please build the interactives first.")
    print("You can run ./build.py --dev from the projects/interactives folder to build them.")
    sys.exit(1)

with pushd("../../bases/rsptx/assignment_server_api/assignment_builder"):
    subprocess.run(["npm", "install"], check=True)
    subprocess.run(["npm", "run", "build"], check=True)

if "--fromroot" not in sys.argv:
    subprocess.run(["poetry", "build-project"], check=True)
