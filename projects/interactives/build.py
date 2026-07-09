#!/usr/bin/env python

import subprocess
import sys
import os
import pathlib
from rsptx.cl_utils.core import pushd
import toml
import json
from json2xml import json2xml


project = toml.load("pyproject.toml")

if sys.argv[1:] == ["--test"]:
    VERSION = "test"
else:
    # pyproject was migrated from poetry ([tool.poetry]) to PEP 621 ([project]);
    # fall back to the old location for safety.
    VERSION = project.get("project", {}).get("version") or project["tool"][
        "poetry"
    ]["version"]



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

# if "--fromroot" not in sys.argv:
#     subprocess.run(["poetry", "build-project"], check=True)


if sys.argv[1:] == ["--publish"]:
    # Do not send to PYPI, just publish the .tgz to the CDN and update the author_server and rsmanage dependencies.  The .tgz is published to the CDN so that it can be used in the package.json for author_server and rsmanage without needing to publish to PYPI first.
    #subprocess.run(["poetry", "publish"], check=True)

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
        try:
            # tag the release in the repo
            subprocess.run(
                ["git", "tag", f"components_{VERSION}"], check=True
            )
        except subprocess.CalledProcessError:
            print(f"Failed to tag release components_{VERSION}")
        print("Moving release to jsdist")
        subprocess.run(
            " ".join(["mv", f"dist-{VERSION}.tgz", "../jsdist"]), check=True, shell=True
        )
    with pushd("../../bases/rsptx/interactives"):
        if os.path.exists("./extra_dependencies"):
            folders = [f for f in os.listdir("./extra_dependencies") if os.path.isdir(os.path.join("./extra_dependencies", f))]
            for folder in folders:
                subprocess.run(
                    [
                        "rsync",
                        "-avz",
                        os.path.join("./extra_dependencies", folder),
                        "balance.runestoneacademy.org:/var/www/html/cdn/runestone",
                    ],
                    check=True,
                )

