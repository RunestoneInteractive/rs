#!/usr/bin/env python

import subprocess
import sys
import os
from rsptx.cl_utils.core import pushd
import toml
import json
from json2xml import json2xml


project = toml.load("pyproject.toml")

if sys.argv[1:] == ["--test"]:
    VERSION = "test"
else:
    VERSION = project["tool"]["poetry"]["version"]


with pushd("../../bases/rsptx/interactives"):
    if "--dev" in sys.argv:
        subprocess.run(["npm", "install"], check=True)
        debug = False
        if "--to" in sys.argv:
            book = sys.argv[sys.argv.index("--to") + 1]
            static_path = f"{os.environ['BOOK_PATH']}/{book}/published/{book}/_static"
            debug = True
        elif "--static" in sys.argv:
            static_path = sys.argv[sys.argv.index("--static") + 1]
            debug = True
        if debug:
            print("Building to:", static_path)
            subprocess.run(
                ["npm", "run", "build", "--", "--env", f"builddir={static_path}"],
                check=True,
            )
            data = json.loads(
                open(os.path.join(static_path, "webpack_static_imports.json")).read()
            )
            with open(
                os.path.join(static_path, "webpack_static_imports.xml"), "w"
            ) as f:
                f.write(json2xml.Json2xml(data).to_xml())
        else:
            subprocess.run(["npm", "run", "build"], check=True)
            subprocess.run(
                ["python", "./scripts/dist2xml.py", f"{VERSION}"], check=True
            )
    else:
        subprocess.run(["npm", "ci"], check=True)
        subprocess.run(["npm", "run", "dist"], check=True)
        subprocess.run(["python", "./scripts/dist2xml.py", f"{VERSION}"], check=True)

if "--dev" in sys.argv:
    sys.exit(0)

if "--fromroot" not in sys.argv:
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
        # tag the release in the repo
        subprocess.run(
            ["git", "tag", f"components_{VERSION}"], check=True
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
