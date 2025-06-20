# ***********************************
# |docname| - Celery Worker Functions
# ***********************************
# Use celery worker functions for long running processes like building a book.
#
#
# Imports
# =======
# These are listed in the order prescribed by `PEP 8`_.
#
# Standard library
# ----------------
import datetime
import os
import sys
import subprocess
import logging
import pathlib
from typing import Optional

from sqlalchemy import create_engine

# Third Party
# -----------
from celery import Celery
from celery.exceptions import Ignore
import pandas as pd

# Local Application
# -----------------
from rsptx.build_tools.core import _build_runestone_book, _build_ptx_book
from rsptx.data_extract.anonymizeCourseData import Anonymizer

# Set up logging

logger = logging.getLogger("runestone")
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(levelname)s: %(asctime)s:  %(funcName)s: %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)
rslogger = logger


# Because we are reusing many functions also used by `rsmanage` to do various build tasks
# I wanted a way to have the click status messages come back to the web UI.  So,
# we will pass in our own version of click.echo to these functions that
# uses the status functions of celery workers.
# update state - https://www.distributedpython.com/2018/09/28/celery-task-states/#:~:text=The%20update_state%20method.%20The%20Celery%20task%20object%20provides,define%20your%20own%20state%20is%20a%20unique%20name.
class MyClick:
    def __init__(self, worker, state):
        self.worker = worker
        self.state = state
        self.logger = None
        logger.debug(f"MyClick worker is {self.worker}")

    def echo(self, message):
        logger.debug(f"UPDATE State: {self.state} {message}")
        self.worker.update_state(state=self.state, meta={"current": message})
        if self.logger:
            self.logger.info(f"UPDATE State: {self.state} {message}")

    def add_logger(self, logger):
        """
        Add a logger to the MyClick instance.
        This is not used in this context but can be useful for debugging.
        """
        self.logger = logger
        self.logger.setLevel(logging.DEBUG)
        rslogger.debug(f"MyClick logger set to {self.logger}")
        logger.debug(f"MyClick logger set to {self.logger}")


# Mock the click config object. It is only used for dburl information in this context
class Config:
    def __init__(self):
        conf = os.environ.get("SERVER_CONFIG", "production")
        if conf == "production":
            self.dburl = os.environ.get("DBURL")
        elif conf == "development":
            self.dburl = os.environ.get("DEV_DBURL")
        elif conf == "test":
            self.dburl = os.environ.get("TEST_DBURL")
        else:
            print("Incorrect WEB2PY_CONFIG")
        print(f"DBURL is {self.dburl}")


config = Config()

celery = Celery(__name__)
celery.conf.broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379")
celery.conf.result_backend = os.environ.get(
    "CELERY_RESULT_BACKEND", "redis://localhost:6379"
)
celery.conf.broker_connection_retry_on_startup = True

# new worker
# 1. pull from github for the given repo
# 2. build
# 3. Update the _static (for ptx)
# 4. process manifest (for ptx)
# 5. Update the library


@celery.task(bind=True, name="clone_runestone_book")
def clone_runestone_book(self, book, url=None):
    """
    Clone a runestone book from github and update its repo_path in the library table.

    :param book: book name (basecourse)
    :param url: Optional git repository URL. If not provided, defaults to RunestoneInteractive GitHub repo
    :return: True if successful, False if clone fails or database update fails
    """
    if url is None:
        url = f"https://github.com/RunestoneInteractive/{book}"

    if not os.path.exists("/books"):
        os.mkdir("/books")

    os.chdir("/books")
    res = subprocess.run(["git", "clone", url], capture_output=True)
    if res.returncode != 0:
        logger.error(f"git clone failed for {book}")
        logger.error(res.stderr.decode())
        return False

    return True


def get_work_dir(book: str) -> str:
    """
    Get the working directory for a book, using repo_path from library table if available.

    :param book: book name (basecourse)
    :return: working directory path - either custom repo_path or default /books/{book}
    """
    repo_path = get_repo_path(book)
    return repo_path if repo_path else f"/books/{book}"


def get_repo_path(book: str) -> Optional[str]:
    """
    Get the repo_path for a book from the library table

    :param book: book name (basecourse)
    :return: repo_path or None if not found
    """
    engine = create_engine(config.dburl)
    df = pd.read_sql_query(
        """select repo_path from library where basecourse = %(cname)s""",
        params=dict(cname=book),
        con=engine,
    )
    if df.empty:
        return None
    return df.iloc[0]["repo_path"]


def git_pull(self, book, source_path=None):
    """
    Pull latest version of a book from github.

    :param self: celery task
    :param book: book name (basecourse)
    :param source_path: Path to the book source (default: /books/{book})
    :return: True if successful
    """
    work_dir = get_work_dir(book)

    logger.debug(f"work_dir = {work_dir}")

    res = subprocess.run(
        ["git", "reset", "--hard", "HEAD"], capture_output=True, cwd=work_dir
    )
    if res.returncode != 0:
        outputlog = pathlib.Path(work_dir, "author_build.log")
        with open(outputlog, "a") as olfile:
            olfile.write(res.stdout.decode("utf8"))
            olfile.write("\n====\n")
            olfile.write(res.stderr.decode("utf8"))
        self.update_state(
            state="FAILURE",
            meta={
                "exc_type": "RuntimeError",
                "exc_message": "Reset failed",
                "current": "git reset failed",
            },
        )
        raise Ignore()
    res = subprocess.run(
        ["git", "clean", "--force", "-d"], capture_output=True, cwd=work_dir
    )
    if res.returncode != 0:
        outputlog = pathlib.Path(work_dir, "author_build.log")
        with open(outputlog, "a") as olfile:
            olfile.write(res.stdout.decode("utf8"))
            olfile.write("\n====\n")
            olfile.write(res.stderr.decode("utf8"))
        self.update_state(
            state="FAILURE",
            meta={
                "exc_type": "RuntimeError",
                "exc_message": "Clean failed",
                "current": "git clean failed",
            },
        )
        raise Ignore()
    res = subprocess.run(
        ["git", "pull", "--rebase", "--no-edit", "--strategy-option=theirs"],
        capture_output=True,
        cwd=work_dir,
    )
    if res.returncode != 0:
        outputlog = pathlib.Path(work_dir, "author_build.log")
        with open(outputlog, "a") as olfile:
            olfile.write(res.stdout.decode("utf8"))
            olfile.write("\n====\n")
            olfile.write(res.stderr.decode("utf8"))
        self.update_state(
            state="FAILURE",
            meta={
                "exc_type": "RuntimeError",
                "exc_message": "Pull failed",
                "current": "git pull failed",
            },
        )
        raise Ignore()


@celery.task(bind=True, name="build_runestone_book")
def build_runestone_book(self, book):
    """
    Build a runestone book using the runestone build tools.

    :param self: celery task
    :param book: book name (basecourse)
    :return: True if build succeeds, False otherwise
    """
    logger.debug(f"Building {book}")
    self.update_state(state="CHECKING", meta={"current": "pull latest"})
    git_pull(self, book)
    myclick = MyClick(self, "BUILDING")
    self.update_state(state="BUILDING", meta={"current": "running build"})

    repo_path = get_work_dir(book)
    os.chdir(repo_path)

    res = _build_runestone_book(config, book, click=myclick)
    if res:
        self.update_state(state="FINISHING", meta={"current": "changing permissions"})
    else:
        self.update_state(state="BUILDING", meta={"current": "Build failed -- see log"})

    try:
        subprocess.run(["chgrp", "-R", "www-data", "."], check=True, cwd=repo_path)
        subprocess.run(["chmod", "-R", "go+rw", "."], check=True, cwd=repo_path)
    except subprocess.CalledProcessError as e:
        self.update_state(
            state="FAILURE",
            meta={"exc_type": "RuntimeError", "exc_message": str(e)},
        )
        return False
    self.update_state(state="SUCCESS", meta={"current": "build complete"})
    update_last_build(book)
    return True


@celery.task(bind=True, name="build_ptx_book")
def build_ptx_book(self, book, generate=False, target="runestone", source_path=None):
    """
    Build a PreTeXt book using the PreTeXt build tools.

    :param self: celery task
    :param book: book name (basecourse)
    :param generate: Whether to generate the book (default: False)
    :param target: build target (default: 'runestone')
    :param source_path: Path to the book source (default: /books/{book})
    :return: True if build succeeds, False otherwise
    """
    if target is None:
        target = "runestone"
    logger.debug(f"Building {book} with target {target} at {source_path}")

    work_dir = get_work_dir(book)
    logger.debug(f"work_dir = {work_dir}")
    if source_path:
        base_path = pathlib.Path(work_dir, source_path)
    else:
        base_path = pathlib.Path(work_dir)
    logger.debug(f"base_path = {base_path}")
    outputlog = pathlib.Path(base_path, "author_build.log")
    start_time = datetime.datetime.now()
    try:
        with open(outputlog, "w") as olfile:
            olfile.write(f"Starting build on {start_time}\n")
    except Exception as e:
        logger.error(f"Failed to write to log file: {str(e)}")
        logger.error(f"Absolute path to log file: {outputlog.absolute()}")
        self.update_state(
            state="FAILURE",
            meta={
                "exc_type": "RuntimeError",
                "exc_message": str(e),
                "current": "Failed to write to log file",
            },
        )
        return False
    self.update_state(state="CHECKING", meta={"current": "pull latest"})
    git_pull(self, book)

    os.chdir(base_path)
    logger.debug(f"Before building myclick self = {self}")
    myclick = MyClick(self, "PTXBUILD")
    logger.debug("Starting build")
    res = _build_ptx_book(
        config, generate, "runestone-manifest.xml", book, click=myclick, target=target
    )
    if res:
        self.update_state(state="FINISHING", meta={"current": "updating permissions"})
    else:
        self.update_state(state="BUILDING", meta={"current": "Failed - see log"})
        return False

    res = subprocess.run(
        "chgrp -R www-data .", shell=True, capture_output=True, cwd=work_dir
    )
    if res.returncode != 0:
        return False
    res = subprocess.run(
        "chmod -R go+rw .", shell=True, capture_output=True, cwd=work_dir
    )
    if res.returncode != 0:
        return False

    self.update_state(state="SUCCESS", meta={"current": "build complete"})
    update_last_build(book)
    return True


# This task requires you to have an ssh keypair set up, and when you build the container
# you will need to make sure to copy the key into /usr/src/app/
@celery.task(bind=True, name="deploy_book")
def deploy_book(self, book):
    """
    Deploy a book to the production server.

    :param self: celery task
    :param book: book name (basecourse)
    :return: True if deployment succeeds, False otherwise
    """
    logger.debug(f"Deploying {book}")
    user = "bmiller"
    self.update_state(state="STARTING", meta={"current": "pull latest"})
    numServers = int(os.environ["NUM_SERVERS"].strip())

    for i in range(1, numServers + 1):
        command = f"ssh -oStrictHostKeyChecking=no {user}@server{i} 'mkdir -p ~/books/{book}/published{book}'"
        res = subprocess.run(
            command,
            shell=True,
            capture_output=True,
        )
        if res.returncode != 0:
            logger.debug(res.stdout)
            logger.debug(res.stderr)
            return False
        command = f"rsync -e 'ssh -oStrictHostKeyChecking=no'  --exclude '__pycache__' -P -rzc /books/{book}/published/{book} {user}@server{i}:~/books/{book}/published --copy-links --delete"
        logger.debug(command)
        self.update_state(state="DEPLOYING", meta={"current": f"server{i}"})
        res = subprocess.run(
            command,
            shell=True,
            capture_output=True,
        )
        if res.returncode != 0:
            logger.debug(res.stdout)
            logger.debug(res.stderr)
            return False
    self.update_state(state="SUCCESS", meta={"current": "deploy complete"})
    update_last_sync(book)
    return True


@celery.task(bind=True, name="useinfo_to_csv")
def useinfo_to_csv(self, classname, username):
    """
    Extract useinfo data from the database and save it to a CSV file.

    :param self: celery task
    :param classname: course name
    :param username: username for the CSV file
    :return: True if extraction succeeds, False otherwise
    """
    os.chdir("/usr/src/app")
    dburl = os.environ.get("DEV_DBURL")
    eng = create_engine(dburl)
    self.update_state(state="QUERYING", meta={"current": "extracting from database"})
    df = pd.read_sql_query(
        """select * from useinfo where course_id = %(cname)s order by id""",
        params=dict(cname=classname),
        con=eng,
    )
    p = pathlib.Path("downloads", "logfiles", username)
    p.mkdir(parents=True, exist_ok=True)
    p = p / f"{classname}_useinfo.csv.zip"
    self.update_state(state="WRITING", meta={"current": "creating csv.zip file"})
    df.to_csv(p, index=False, compression={"method": "zip"})
    self.update_state(state="SUCCESS", meta={"current": "csv.zip file created"})
    return True


@celery.task(bind=True, name="code_to_csv")
def code_to_csv(self, classname, username):
    """
    Extract code data from the database and save it to a CSV file.

    :param self: celery task
    :param classname: course name
    :param username: username for the CSV file
    :return: True if extraction succeeds, False otherwise
    """
    os.chdir("/usr/src/app")
    dburl = os.environ.get("DEV_DBURL")
    eng = create_engine(dburl)
    self.update_state(state="QUERYING", meta={"current": "extracting from database"})
    df = pd.read_sql_query(
        """select acid, code, emessage, course_id, sid, timestamp, comment, language
        from code join courses on code.course_id = courses.id
        where courses.course_name = %(cname)s order by code.id""",
        params=dict(cname=classname),
        con=eng,
    )
    p = pathlib.Path("downloads", "logfiles", username)
    p.mkdir(parents=True, exist_ok=True)
    p = p / f"{classname}_code.csv.zip"
    self.update_state(state="WRITING", meta={"current": "creating csv.zip file"})
    df.to_csv(p, index=False, compression={"method": "zip"})
    self.update_state(state="SUCCESS", meta={"current": "csv.zip file created"})
    return True


@celery.task(bind=True, name="anonymize_data_dump")
def anonymize_data_dump(self, **kwargs):
    """
    Anonymize data for a course and save it to a datashop file.

    :param self: celery task
    :param kwargs: keyword arguments for the anonymization process
    :return: True if anonymization succeeds, False otherwise
    """
    os.chdir("/usr/src/app")
    basecourse = kwargs["basecourse"]
    del kwargs["basecourse"]
    username = kwargs["user"]
    del kwargs["user"]
    a = Anonymizer(basecourse, config.dburl, **kwargs)
    # if kwargs has a specific course then skip the course selection
    print("Choosing Courses")
    self.update_state(state="WORKING", meta={"current": "Choosing courses"})
    a.choose_courses()
    print("Getting Users")
    self.update_state(state="WORKING", meta={"current": "Anonymizing users"})
    a.get_users()
    print("Getting user activities")
    self.update_state(state="WORKING", meta={"current": "Processing user activities"})
    a.get_user_activities()
    print("sessionizing")
    self.update_state(state="WORKING", meta={"current": "Sessionizing the data"})
    a.sessionize_data()
    print("combining to datashop")
    self.update_state(
        state="WORKING", meta={"current": "combining all data (be patient)"}
    )
    a.create_datashop_data()
    self.update_state(state="WORKING", meta={"current": "Writing datashop file"})
    p = pathlib.Path("downloads", "datashop", username)
    p.mkdir(parents=True, exist_ok=True)
    a.write_datashop(path=p)
    self.update_state(state="SUCCESS", meta={"current": "Ready for download"})
    return True


def update_last_build(book):
    """
    Update the last build timestamp for a book by touching the build_success file.

    :param book: book name (basecourse)
    """
    # check to see if build_success exists and if not create it
    if not os.path.exists(f"/books/{book}/build_success"):
        pathlib.Path(f"/books/{book}/build_success").touch()
    else:
        os.utime(f"/books/{book}/build_success", None)


def update_last_sync(book):
    """
    Update the last sync timestamp for a book by touching the sync_success file.

    :param book: book name (basecourse)
    """
    # check to see if sync_success exists and if not create it
    if not os.path.exists(f"/books/{book}/sync_success"):
        pathlib.Path(f"/books/{book}/sync_success").touch()
    else:
        os.utime(f"/books/{book}/sync_success", None)
