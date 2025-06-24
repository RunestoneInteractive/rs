#!/usr/bin/env python3

# Just a quick wrapper around what is in runestone utils to make it easier to do a full build
# of a PreTeXt book outside of docker
import os
import subprocess
import sys
import pathlib
import fnmatch

from rsptx.build_tools.core import _build_ptx_book
import click


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


@click.command()
@click.option("--target", default="runestone", help="The target to build for")
@click.option("--clean", is_flag=True, default=False, help="Clean the build directory before building")
@click.argument("bookname")
def build_book(target, clean, bookname):
    p = pathlib.Path.cwd()

    if clean:
        if (p / "published" / bookname / "_static").exists():
            print(f"Cleaning {bookname}")
            remove_unmatched(p / "published" / bookname / "_static", ["pretext"])

    print(f"Building target: {target}")

    if (p / "project.ptx").exists():  # we are in a pretext project
        print(f"Building {bookname} in place")
    else:
        print("Can't find project.ptx!  You must either name a book or be in the book's folder")
        exit(-1)

    config = Config()
    assert bookname

    res = _build_ptx_book(config, False, "runestone-manifest.xml", bookname)
    if not res:
        print("build failed")
        exit(-1)

    # touch the file build_complete
    with open("build_success", "w") as f:
        f.write("build success")

    res = subprocess.run(f"chgrp -R www-data .", shell=True, capture_output=True)
    if res.returncode != 0:
        print("failed to change group")

    res = subprocess.run(f"chmod -R go+rw .", shell=True, capture_output=True)
    if res.returncode != 0:
        print("failed to change permissions")


if __name__ == "__main__":
    build_book()



def remove_unmatched(path, patterns, verbose=False):
    """
    Recursively remove files and directories under the given path that do NOT match
    any of the given glob patterns. Directories that match a pattern are preserved along
    with their contents.
    
    Args:
        path (str): The directory path whose contents will be processed.
        patterns (list of str): List of glob patterns (e.g., ['*.txt', 'keep_dir']) that should be kept.
        verbose (bool): If True, print detailed information about removed files and directories.
    """
    # If path is not a directory, handle it as a file.
    if os.path.isfile(path):
        if not any(fnmatch.fnmatch(os.path.basename(path), pat) for pat in patterns):
            print(f"Removing file: {path}")
            os.remove(path)
        return

    # List all items in the directory.
    for entry in os.listdir(path):
        full_entry = os.path.join(path, entry)
        # Determine if the entry matches any pattern.
        entry_matches = any(fnmatch.fnmatch(entry, pat) for pat in patterns)
        
        if os.path.isdir(full_entry):
            if entry_matches:
                # Directory matches a pattern: leave it and its contents untouched.
                print(f"Keeping directory (matches pattern): {full_entry}")
                continue
            else:
                # Recurse into the directory.
                remove_unmatched(full_entry, patterns)
                # After processing, remove the directory if it is now empty.
                if not os.listdir(full_entry):
                    print(f"Removing empty directory: {full_entry}")
                    os.rmdir(full_entry)
        else:
            # For files, remove if no pattern matches.
            if not entry_matches:
                if verbose:
                    print(f"Removing file: {full_entry}") 
                os.remove(full_entry)

