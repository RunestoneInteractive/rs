#!/usr/bin/env python3

# Just a quick wrapper around what is in runestone utils to make it easier to do a full build
# of a PreTeXt book outside of docker
import os
import subprocess
import sys
import pathlib
from rsptx.build_tools.core import _build_ptx_book

p = pathlib.Path.cwd()
print(sys.argv)
if len(sys.argv) < 2:
    print("You must specify a book name")
    exit(-1)
else:
    bookname = sys.argv[1]

if "--target" in sys.argv:
    target = sys.argv[sys.argv.index("--target") + 1]
else:
    target = "runestone"

print(f"Building target: {target}")

if (p / "project.ptx").exists():  # we are in a pretext project
    print(f"Building {sys.argv[1]} in place")
    bookname = sys.argv[1]
else:
    print("You must either name a book or be in the book's folder")
    exit(-1)


class Config:
    def __init__(self):
        conf = os.environ.get("WEB2PY_CONFIG", "production")
        if conf == "production":
            self.dburl = os.environ.get("DBURL")
        elif conf == "development":
            self.dburl = os.environ.get("DEV_DBURL")
        elif conf == "test":
            self.dburl = os.environ.get("TEST_DBURL")
        else:
            print("Incorrect WEB2PY_CONFIG")


config = Config()
assert bookname

res = _build_ptx_book(config, False, "runestone-manifest.xml", bookname)
if not res:
    print("build failed")
    exit(-1)

res = subprocess.run(f"chgrp -R www-data .", shell=True, capture_output=True)
if res.returncode != 0:
    print("failed to change group")
    exit(-1)
res = subprocess.run(f"chmod -R go+rw .", shell=True, capture_output=True)
if res.returncode != 0:
    print("failed to change permissions")
    exit(-1)
