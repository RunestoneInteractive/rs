#!/usr/bin/env python3


import os
import subprocess
from dotenv import load_dotenv

load_dotenv()

print("Checking your environment")
finish = False
for var in [
    "RUNESTONE_PATH",
    "SERVER_CONFIG",
    "DBURL",
    "DEV_DBURL",
    "BOOK_PATH",
    "WEB2PY_CONFIG",
]:
    if var not in os.environ:
        print(f"Environment variable {var} not set")
        finish = True
    else:
        print(f"{var} is set")

if finish:
    print(
        "Your environment is not set up correctly.  Please define the environment variables listed above."
    )
    exit(1)


print("Building projects")
for proj in os.listdir("projects"):
    if os.path.isdir(f"projects/{proj}"):
        os.chdir(f"projects/{proj}")
        print(f"Project: {proj}")
        if os.path.isfile("pyproject.toml"):
            subprocess.run(["poetry", "build-project"])
        os.chdir("../..")

print("Building docker images")
subprocess.run(["docker", "compose", "build"])
