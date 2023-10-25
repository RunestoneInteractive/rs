#!/usr/bin/env python

import subprocess
import sys
from rsptx.cl_utils.core import pushd
import toml

project = toml.load("pyproject.toml")

if sys.argv[1:] == ["--test"]:
    VERSION = "test"
else:
    VERSION = project["tool"]["poetry"]["version"]


with pushd("../../bases/rsptx/interactives"):
    if "--dev" in sys.argv:
        subprocess.run(["npm", "run", "build"], check=True)
    else:
        subprocess.run(["npm", "run", "dist"], check=True)
    subprocess.run(["python", "./scripts/dist2xml.py", f"{VERSION}"], check=True)


subprocess.run(["poetry", "build-project"], check=True)


if sys.argv[1:] == ["--publish"]:
    subprocess.run(["poetry", "publish"], check=True)

    with pushd("../../bases/rsptx/interactives/runestone"):
        subprocess.run(
            " ".join(
                [
                    "tar",
                    "--strip-components",
                    "1",
                    "-zcf",
                    f"dist-{VERSION}.tgz",
                    "dist/*",
                ]
            ),
            check=True,
            shell=True,  # needed so that the glob is expanded
        )
        print("Installing release on CDN")
        subprocess.run(
            ["scp", f"dist-{VERSION}.tgz", "balance.runestoneacademy.org:~/"],
            check=True,
        )
        subprocess.run(
            [
                "ssh",
                "balance.runestoneacademy.org",
                "/home/bmiller/bin/install_release.sh",
                VERSION,
            ],
            check=True,
        )
        print("Moving release to jsdist")
        subprocess.run(
            " ".join(["mv", f"dist-{VERSION}.tgz", "../jsdist"]), check=True, shell=True
        )
    with pushd("../author_server"):
        subprocess.run(["poetry", "update", "runestone"], check=True)
        subprocess.run(["poetry", "update", "pretext"], check=True)
    with pushd("../rsmanage"):
        subprocess.run(["poetry", "update", "runestone"], check=True)
        subprocess.run(["poetry", "update", "pretext"], check=True)
