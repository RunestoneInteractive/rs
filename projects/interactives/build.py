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
    VERSION = project["tool"]["poetry"]["version"]


def rebuild_micro_parsons():
    """Rebuild micro-parsons from local source if package.json points to a file: tarball.

    Reads the micro-parsons entry from interactives/package.json.  If it is a
    file: reference, resolves the source directory (the folder containing the
    .tgz), rebuilds the package with `npm run build && npm pack`, and updates
    the .tgz in place so the subsequent `npm install` picks up the fresh build.
    """
    pkg_json = pathlib.Path("../../bases/rsptx/interactives/package.json").resolve()
    pkg = json.loads(pkg_json.read_text())
    mp_ref = pkg.get("dependencies", {}).get("micro-parsons", "")
    if not mp_ref.startswith("file:"):
        print("micro-parsons is not a local file: reference — skipping rebuild")
        return

    # Resolve the path to the .tgz (may be absolute or relative to package.json)
    tgz_path = pathlib.Path(mp_ref[len("file:"):])
    if not tgz_path.is_absolute():
        tgz_path = (pkg_json.parent / tgz_path).resolve()

    src_dir = tgz_path.parent
    print(f"Rebuilding micro-parsons from {src_dir} ...")
    with pushd(str(src_dir)):
        subprocess.run(["npm", "run", "build"], check=True)
        subprocess.run(["npm", "pack"], check=True)
    print("micro-parsons rebuilt successfully.")


with pushd("../../bases/rsptx/interactives"):
    if "--dev" in sys.argv:
        if "--micro-parsons" in sys.argv:
            rebuild_micro_parsons()
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