# ChangeLog

## Updates since last changelog entry (2026-02-12 → 2026-02-20)

Coverage: commits from **2026-02-12** through **2026-02-20** (i.e., changes after the prior cutoff on 2026-02-11).

### Highlights

- **Peer chat cleanup + reliability:** merged fixes to clean up the peer A/B chat experience and to ensure students can still send messages during synchronous chat.
- **Interactive evaluation UX:** added a new `showEval` capability for interactives.
- **Assessment data correctness:** fixed a shortanswer issue by correcting the underlying answers table name.
- **Verbal discussion improvements:** updated the verbal discussion UI to show who a student is grouped with.
- **Scratch ActiveCode layout polish:** adjusted Scratch ActiveCode positioning / CSS.
- **Ops/config + dependency updates:** multiple internal updates (logging, course OpenAI key plumbing, fernet secret handling) plus package/version bumps.

### Commit notes (for reference)

- 6d5383df Merge PR #1153 (peer A/B chat cleanup)
- 3efce80b new showEval for use with interactives
- 8d56fcaa Fix: correct the table name for shortanswer answers
- b2dfc2f1 Updated the verbal discussion to show who students are in a group with
- 6a40b256 Merge PR #1147 (Scratch AC CSS update)
- 36c319a3 Update packages
- 0ccdc6e5 Merge PR #10 (fastapi-peer-llm)
- dea3f13d ensure students can send message during sync chat
- 90b2636f update logging
- de3fa2a7 update get course openai key
- 21f64240 update fernet secret
- b6134724 new version

---

## Updates since last changelog entry (2026-02-07 → 2026-02-11)

Coverage: commits from **2026-02-07** through **2026-02-11** (since the prior cutoff of 2026-02-06).

### Highlights

- **Java/ActiveCode execution (JOBE) + unit test results:** wired in JOBE-based submission flow for Java ActiveCode with unit tests, and surfaced results end-to-end. This work primarily touched the personalized-parsons endpoints and ActiveCode client JS.
- **Personalized Parsons cleanup:** removed unused variables and tidied related evaluation code.
- **Question counting fixes:** corrected “number of questions” accounting in both backend CRUD (`question.py`) and frontend book utilities (`bookfuncs.js`).
- **Build output enhancements:** added a new preprocessor to inject **GitHub source links** into generated HTML output (`add_github_links.py`).
- **Repo hygiene:** removed empty placeholder files (`content`, `docker-compose.override.yml`, `pi_attempt_id`).
- **Release/version bump:** bumped interactives version (`projects/interactives/pyproject.toml`).

### Commit notes (for reference)

- 682e940d Applied JOBE for submitting Javacode with unit tests and get results
- bf3b9553 removed unused variables
- 06b5b8da Remove empty placeholder files
- 2ebf9adb preprocessor to add github links to html output
- 30773448 Fix: get number of questions correct
- 6c6d1fa9 Count questions correctly
- 4bfc6ed4 new version

---

## 2026 (Year to Date)

Coverage: commits from **2026-01-01** through **2026-02-06**.

### Themes

- **Assignment experience + navigation:** continued refinement of assignment navigation (including “readings” integration) and UI polish.
- **Authoring/build stability:** better build hygiene in `rsptx` tooling (clean logs, cleaned output folders) and dependency work to reduce PreTeXt friction.
- **Instructor/admin capabilities:** expanded tooling for course administration (token cleanup, CSV enrollment) and billing/invoice-related fixes.
- **Assignment Builder options:** improved exercise configuration—especially for ActiveCode (CodeLens) and the new/expanded IFrame exercise type.

### Notable changes (grouped)

#### Releases / version bumps
- Multiple **release/version** bumps (primarily in `projects/interactives/pyproject.toml`).

#### Assignment navigation + readings UX
- Implemented and iterated on **two-way assignment navigation** (top/bottom navigation, readings integration, styling fixes).
- Added `readingNames` support and related UI/markup adjustments.
- Improved assignment navigation behavior and added material icons to assignment pages.

#### Assignment Builder: new capabilities and settings fixes
- **IFrame exercise type:** added IFrame exercise type/components and later removed an iframe height restriction in preview/input.
- **ActiveCode improvements:**
  - Added support for enabling/disabling **CodeLens**.
  - Tightened up settings/preview plumbing and types.
- **CodeTailor options:** updated handling to correctly modify `parsonspersonalize` values.
- Misc. robustness fixes around label toggles (avoid replace/split when `toggleLabels` is null).

#### Peer / Parsons + assessment behavior
- Parsons improvements including fallback to the problem source when restoring a student answer fails.
- Multiple changes in the peer/PI area (dashboard + templates + JS), along with ongoing refinements in the peer router.
- Fixes for MathJax processing and a regression involving counting questions for async.

#### Instructor/Admin operations
- **API token cleanup:** added ability to delete API token(s) for a course, including a “delete all tokens” capability and supporting UI.
- **CSV enrollment:** allow a user to be enrolled in a new course by CSV.

#### Billing / invoicing
- Fixes related to course creation billing flows (invoice checkbox handling) and an additional invoice request fix.

#### Build tooling + dependencies (PreTeXt/author server)
- Build improvements in `components/rsptx/build_tools/core.py`:
  - Start builds with a clean log
  - Clean output folders more reliably
  - Remove leftover debugging (`set_trace`)
- `rsmanage build` gained a `--target` option.
- Dependency work to address **PreTeXt** issues (notably updates in `projects/author_server/poetry.lock` / `pyproject.toml`).

### Month-by-month timeline

#### January 2026
- Merged/landed the two-way assignment navigation work and related readings UI improvements.
- Added/expanded Assignment Builder capabilities (CodeTailor options; IFrame exercise type).
- Improved assignment sorting and decoration of assigned problems.
- Multiple dependency updates (lxml/pretext/runestone) and several small bug-fix releases.
- Addressed billing/invoicing edge cases.

#### February 2026 (so far)
- Instructor tooling: token deletion support (including bulk delete).
- Authoring/build stability: PreTeXt dependency fixes; cleaner build logs; output folder cleanup; `rsmanage build --target`.
- Minor version bumps and cleanup.

---

### How to read this repo’s recent work
Most of the work since Jan 1 clusters into three areas:
1) **Learner/instructor experience** (assignment nav + builder settings)
2) **Operational/admin tooling** (billing, enrollment, token hygiene)
3) **Platform stability** (dependencies + build predictability)
