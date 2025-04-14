import logging
import sys
import os

def get_log_level():
    log_level = os.getenv("LOG_LEVEL", "DEBUG")
    if log_level == "DEBUG":
        return logging.DEBUG
    elif log_level == "INFO":
        return logging.INFO
    elif log_level == "WARNING":
        return logging.WARNING
    elif log_level == "ERROR":
        return logging.ERROR
    elif log_level == "CRITICAL":
        return logging.CRITICAL
    else:
        return logging.INFO

simple_logger = logging.getLogger("pylti1p3")
simple_logger.setLevel(get_log_level())

handler = logging.StreamHandler(sys.stdout)
handler.setLevel(get_log_level())
formatter = logging.Formatter(
    "%(levelname)s - %(asctime)s - %(funcName)s - %(message)s"
)
handler.setFormatter(formatter)
simple_logger.addHandler(handler)