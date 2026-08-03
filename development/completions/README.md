# zsh completion for `rsmanage`

`_rsmanage` completes subcommands, their options, and the nested `library`
subcommands — each with its help text as the description.

## Install

Point `fpath` at this directory before `compinit` runs, in `~/.zshrc`:

```zsh
fpath=(~/rs/development/completions $fpath)
autoload -Uz compinit && compinit
```

If you already call `compinit` (most configs, oh-my-zsh included), the `fpath`
line must come *before* it. Then start a new shell, or:

```zsh
rm -f ~/.zcompdump && exec zsh
```

Sourcing the file directly also works, if you would rather not touch `fpath`:

```zsh
source ~/rs/development/completions/_rsmanage
```

## `uv run rsmanage`

The completion is registered for the command name `rsmanage`, so it fires when
that is the first word. With the venv active (`source .venv/bin/activate`) that
is the normal case and everything works.

If you usually type `uv run rsmanage`, add an alias — completion follows it:

```zsh
alias rsmanage="uv run --project ~/rs rsmanage"
compdef _rsmanage rsmanage
```

## Regenerating

The file is generated from click's own command tree, so it is a snapshot. After
adding or changing an rsmanage command or option:

```zsh
uv run python development/completions/generate.py
```

Commit the regenerated `_rsmanage` alongside the command change. Output is
deterministic, so a no-op regeneration produces no diff.

If you use `just`, this recipe is a convenient wrapper (the repo's `justfile`
is gitignored, so add it to your own):

```just
# regenerate the zsh completion for rsmanage
completions:
    #!/usr/bin/env bash
    source ~/rs/.venv/bin/activate
    python development/completions/generate.py
```

## Why not click's built-in completion?

Click can emit a completion script (`_RSMANAGE_COMPLETE=zsh_source rsmanage`),
and it stays in sync automatically. Two things make it a bad fit here:

- **Speed.** It shells out to Python on every TAB. Measured on this repo, about
  525 ms per keypress — slow enough to feel broken.
- **PATH.** The script it generates starts with
  `(( ! $+commands[rsmanage] )) && return 1`, so it silently does nothing
  whenever `rsmanage` is not on PATH — which is the case whenever the venv is
  not active.

The static file has neither problem; the tradeoff is having to regenerate it.

## Not completed

Option *values* are left open — `--course <TAB>` will not list your actual
course names. Doing that means a database round-trip per keypress, which is the
same latency problem as above. `rsmanage courseinfo` is the way to look one up.
