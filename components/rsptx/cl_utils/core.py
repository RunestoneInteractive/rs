# ``core.py`` - Utilities supporting continuous integration tests
# ===============================================================
#
# Imports
# -------
# These are listed in the order prescribed by [PEP
# 8](http://www.python.org/dev/peps/pep-0008/#imports).
#
# ### Standard library
import asyncio
import io
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Awaitable, Callable, Literal, Sequence, cast

# ### Local imports
from dotenv import load_dotenv

# OS detection
# ------------
# This follows the [Python
# recommendations](https://docs.python.org/3/library/sys.html#sys.platform).
is_win = sys.platform == "win32"
is_linux = sys.platform.startswith("linux")
is_darwin = sys.platform == "darwin"

# Copied from the [Python
# docs](https://docs.python.org/3.5/library/platform.html#cross-platform).
is_64bits = sys.maxsize > 2**32


# Support code
# ------------
# ### xqt
# Pronounced "execute": provides a simple way to execute a system command.
def xqt(
    # Commands to run. For example, `'foo -param firstArg secondArg', 'bar |
    # grep alpha'`.
    *cmds: list[str],
    # This is passed directly to `subprocess.run`.
    check: bool = True,
    # This is passed directly to `subprocess.run`.
    shell: bool = True,
    # Optional keyword arguments to pass on to
    # [subprocess.run](https://docs.python.org/3/library/subprocess.html#subprocess.run).
    **kwargs: Any,
) -> subprocess.CompletedProcess | list[subprocess.CompletedProcess]:
    ret = []
    # Although the
    # [docs](https://docs.python.org/3/library/subprocess.html#subprocess.Popen)
    # state, "The only time you need to specify `shell=True` on Windows is when
    # the command you wish to execute is built into the shell (e.g. **dir** or
    # **copy**). You do not need `shell=True` to run a batch file or
    # console-based executable.", use `shell=True` to both allow shell commands
    # and to support simple redirection (such as `blah > nul`, instead of
    # passing `stdout=subprocess.DEVNULL` to `check_call`).
    for cmd in cmds:
        # Per
        # [SO](http://stackoverflow.com/questions/15931526/why-subprocess-stdout-to-a-file-is-written-out-of-order),
        # the `run` below will flush stdout and stderr, causing all the
        # subprocess output to appear first, followed by all the Python output
        # (such as the print statement above). So, flush the buffers to avoid
        # this.
        wd = kwargs.get("cwd", os.getcwd())
        flush_print(f"{wd}$ {cmd}")
        # Use bash instead of sh, so that `source` and other bash syntax works.
        # See
        # [subprocess.popen](https://docs.python.org/3/library/subprocess.html#subprocess.Popen).
        executable = "/bin/bash" if is_linux or is_darwin else None
        try:
            cp = subprocess.run(
                cmd, shell=shell, executable=executable, check=check, **kwargs
            )
        except subprocess.CalledProcessError as e:
            flush_print(f"{e.stderr or ''}{e.stdout or ''}")
            raise
        ret.append(cp)

    # Return a list only if there were multiple commands to execute.
    return ret[0] if len(ret) == 1 else ret


# ### env
# Transforms `os.environ["ENV_VAR"]` to the more compact `env.ENV_VAR`. Returns
# `None` if the env var doesn't exist.
class EnvType(type):
    def __getattr__(cls, name: str) -> str | None:
        return os.environ.get(name)

    def __setattr__(cls, name: str, value: Any) -> None:
        os.environ[name] = value


class env(metaclass=EnvType):
    pass


# ### pushd
# A context manager for pushd.
class pushd:
    """This is a context manager for pushd.  It will remember where you were
    and take you back there when you exit the context manager.

    :param path: The path to change to upon entering the context manager.
    :type path: str | Path
    """

    def __init__(
        self,
        # The path to change to upon entering the context manager.
        path: str | Path,
        verbose: bool = False,
    ):
        self.path = path
        self.verbose = verbose

    def __enter__(self) -> None:
        if self.verbose:
            flush_print(f"pushd {self.path}")
        self.cwd = os.getcwd()
        os.chdir(str(self.path))

    def __exit__(self, type_, value, traceback) -> Literal[False]:
        if self.verbose:
            flush_print(f"popd - returning to {self.cwd}.")
        os.chdir(str(self.cwd))
        return False


# ### chdir
def chdir(path: str | Path) -> None:
    flush_print(f"cd {path}")
    os.chdir(str(path))


# ### mkdir
def mkdir(path: str | Path, *args, **kwargs) -> None:
    flush_print(f"mkdir {path}")
    Path(path).mkdir(*args, **kwargs)


# ### load .env file
def load_project_dotenv(dotenv_path=None):
    if dotenv_path is None:
        dotenv_path = Path(".env")
    else:
        dotenv_path = Path(dotenv_path)
    if dotenv_path.exists():
        load_dotenv(dotenv_path)
        print("Loaded .env file")
    elif "RUNESTONE_PATH" in os.environ:
        env_path = Path(os.environ["RUNESTONE_PATH"]) / ".env"
        if env_path.exists():
            load_dotenv(env_path)
            print(f"Loaded .env file from {os.environ['RUNESTONE_PATH']}")


# ### flush_print
# Anything sent to `print` won't be printed until Python flushes its buffers,
# which means what CI logs report may be reflect what's actually being executed
# -- until the buffers are flushed.
def flush_print(*args: Any, **kwargs: Any) -> None:
    print(*args, **kwargs)
    # Flush both buffers, just in case there's something in either one.
    sys.stdout.flush()
    sys.stderr.flush()


# ### isfile
def isfile(f: str | Path) -> bool:
    _ = Path(f).is_file()
    flush_print(f"File {f} {'exists' if _ else 'does not exist'}.")
    return _


# ### isdir
def isdir(f: str | Path) -> bool:
    _ = Path(f).is_dir()
    flush_print(f"Directory {f} {'exists' if _ else 'does not exist'}.")
    return _


# This defines the type of an `async` function passed to `stream_command`.
SubprocessStreamerType = Callable[
    # It takes one argument: an stream produced by the subprocess (either
    # `process.stdout` or `process.stderr`). See the [docs](https://docs.python.org/3/library/asyncio-stream.html#streamreader).
    [asyncio.StreamReader],
    # It produces no output, but must be an ``async`` function.
    Awaitable[None],
]


# ### Subprocess streaming
# The following code was originally based on a post on
# [SO](https://stackoverflow.com/a/66400096/16038919).
## {
# This is for use with `stream_command`: provide it with output(s) and an
# (optional) filter, and it will stream data from from the subprocess's
# stdout/stderr to the `output_stream`(s) given below.
def subprocess_streamer(
    # Where to stream the data; typically, `sys.stdout.buffer` or
    # `sys.stderr.buffer`. Note that the asyncio subprocess `stderr` and
    # `stdout` produces bytes only, not text. So, we need to write to
    # `sys.stdout/err` as binary. Therefore, use
    # [.buffer](https://docs.python.org/3/library/io.html#io.TextIOBase.buffer).
    *output_stream: io.IOBase,
    # This optional function filters which input should be written to the
    # output(s). If not specified, all input is written to the output(s).
    filter: Callable[
        # The function takes one parameter: the line read from the process.
        [bytes],
        # It produces one output: either
        #
        # - The line to write to each `output_stream`, or
        # - a sequence of lines to write to each `output_stream`; the first
        #   element of the list is written to the first `output_stream`, etc.
        bytes | Sequence[bytes],
    ] = lambda line: line,
) -> SubprocessStreamerType:
    """
    This is for use with `stream_command`: provide it with output(s) and
    (optionally) a filter, and it will stream data from from the subprocess's
    stdout/stderr to the `output_stream`(s) given below.
    :param filter: _description_, defaults to lambdaline:line
    :type filter: _type_, optional
    :return: _description_
    :rtype: SubprocessStreamerType
    """

    async def _output_stream(
        # `async_run_command` will call this with either `process.stdout` or
        # `process.stderr`.
        input_stream: asyncio.StreamReader,
    ) -> None:
        while not input_stream.at_eof():
            output = await input_stream.readline()
            filtered_output = filter(output)
            if filtered_output:
                for index, _os in enumerate(output_stream):
                    _os.write(
                        filtered_output
                        if isinstance(filtered_output, bytes)
                        else filtered_output[index]
                    )
                    _os.flush()

    return _output_stream


# Run a subprocess and stream the output while it runs. Return the process'
# return code. This is typically called by `stream_command`.
async def async_stream_command(
    # The command to execute; same as the arguments to `subprocess`.
    *command: str,
    # Functions which stream the stdout/stderr produced as the command executes.
    # See the `SubprocessStreamerType` documentation above for more details.
    stdout_streamer: SubprocessStreamerType = subprocess_streamer(
        cast(io.IOBase, sys.stdout.buffer)
    ),
    stderr_streamer: SubprocessStreamerType = subprocess_streamer(
        cast(io.IOBase, sys.stderr.buffer)
    ),
    # These are passed directly to the underlying `subprocess` call.
    **kwargs: Any,
    # The return code produced when the subprocess exits.
) -> int:
    """Execute a command in the background and stream its output.

    :param stdout_streamer: , defaults to subprocess_streamer( cast(io.IOBase, sys.stdout.buffer) )
    :type stdout_streamer: SubprocessStreamerType, optional
    :param stderr_streamer: _description_, defaults to subprocess_streamer( cast(io.IOBase, sys.stderr.buffer) )
    :type stderr_streamer: SubprocessStreamerType, optional
    :return: _description_
    :rtype: int
    """
    # Add stdout/stderr destinations if they aren't specified.
    kwargs.setdefault("stdout", asyncio.subprocess.PIPE)
    kwargs.setdefault("stderr", asyncio.subprocess.PIPE)

    # Start the subprocess.
    process = await asyncio.create_subprocess_exec(
        *command,
        **kwargs,
    )
    # Determine what to stream.
    stream = []
    if process.stdout is not None:
        stream.append(stdout_streamer(process.stdout))
    if process.stderr is not None:
        stream.append(stderr_streamer(process.stderr))

    # Stream stdout and stderr while it runs.
    await asyncio.gather(*stream)

    # Terminate it nicely.
    #
    # `process.communicate()` will have no data to read but will close the pipes
    # that are implemented in C, whereas `process.wait()` will not.
    stdout_data, stderr_data = await process.communicate()
    assert not stdout_data and not stderr_data

    assert process.returncode is not None
    return process.returncode


# The primary function to call, which runs the above function in `asyncio`.
def stream_command(*args: str, **kwargs: Any) -> int:
    return asyncio.run(async_stream_command(*args, **kwargs))


## }
