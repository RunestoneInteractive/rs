# ChangeLog

## Updates since last changelog entry (2026-03-14 → 2026-03-28)

Coverage: changes merged/landed after the previous changelog update commit on **2026-03-13**, through **2026-03-28**.

### Highlights

- **Term start date enforcement (issue-1167 / PR #1185):** major cross-cutting workstream to respect `term_start_date` everywhere — `fetch_last_answer`, `fetch_code`, `fetch_page_activity_counts`, all `_scorable_X` functions, `checkLocalStorage` in interactives, and the `eBookConfig` context dict / layout template; course home page now warns instructors of old/expired courses.
- **Automated testing + CI (new):** full GitHub Actions CI pipeline landed — CRUD test suite, route smoke tests (book + assignment servers), functional route tests with real DB and fake auth, and a CI status badge in the README.
- **Learning clues (continued):** merged the `learning_clues` branch into main; follow-on additions include coach-mode switch, source filter, citation links, study-clues logic abstraction, and logging.
- **Async Peer Instruction UX:** added a step banner with progress dots to async PI, improved voting-stage clarity, and updated the LLM prompt; banner colors refined to shades of blue (PR from conzty01).
- **Canvas timezone fix (PR #1189):** updated LTI1p3 timezone handling to accommodate a recent Canvas change.
- **SmartSearch / CopyExercise modal (issue-829-3 / PR #1175):** refactored `SmartSearchExercises` and `CopyExerciseModal` to support editing and improve UX; added Prism to component templates.
- **Next-question placement fix (PR #1178):** corrected next-question placement and styling.
- **Ops / tooling:** dependency and lock-file updates, pgcli bump, black formatting fixes, Linux build-system init fix, LLM prompt hallucination fix, micro-parsons dependency bump, and a course-list typo fix.

### Commit notes (for reference)

- d3d901ae Fix typo in course list
- 06f8480e Merge pull request #1185 from ascholerChemeketa/no-work-before-term-start
- fd5cb654 Test fixes — safety first STOP if not in test mode
- 861470a1 Merge pull request #1189 from ascholerChemeketa/canvas-tz-fix
- a1563c1a LTI1p3: update timezone handling to accomodate Canvas change
- 29289cc4 Merge branch 'automated_testing'
- 20a47f22 Add CI test status badge to README
- 8235da93 Phase 4: add functional route tests with real DB and fake auth
- 1245b286 Phase 3: add route smoke tests for book and assignment servers
- 8ea0695c Update CI to run full test suite via poetry run pytest
- 22481225 Add automated CRUD test suite with GitHub Actions CI
- 6fe58f54 Add term_start_date to course home page. Warn instructors of old courses
- ea2187a9 Merge pull request #1178 from sethbern/fix-next-question-placement
- e6e12b9e Merge pull request #1175 from morozov-av/issue-829-3
- eb1599da Merge branch 'learning_clues'
- 78142449 abstract the shouldShowStudyClues logic
- 140f811f Interactives: checkLocalStorage respects termStartDate from eBookConfig
- bede5cc0 Interactives: update micro-parsons dependancy to 0.2.0
- 16647263 Add eBookConfig.termStartDate to layout.html template
- 95a97c50 serve_page: add term_start_date to eBookConfig context dict
- e69cff37 Merge branch 'morozov-av-issue-1167'
- e1f0a3ea All _scorable_X functions check term start date
- c05bbc28 Bugfix for lp_answers practice start time
- c1b90ba7 fetch_last_answer and fetch_code respect term_start_date
- 236f942d Book fetch_page_activity_counts respects term_start_date
- 377080d1 Add prism to component templates
- 6495b7cc Refactor: enhance SmartSearchExercises and CopyExerciseModal to support editing and improve UX
- b860d1ee Add logging for learning clues
- a4f44d45 update LLM prompt to stop hallucinating a code snippet when there is none
- edf40963 fix black formatting
- fbc69136 change banner to be shades of blue. added step dots to show which stage they are at
- 228138ca Merge branch 'conzty01-main'
- cab35979 Fix: linux needs -T for piped input, use parms instead
- 1d781c12 make sure build system is initialized
- e7e0e99f Add step banner to async PI and improve voting stage clarity
- c76b918f update prompt
- 9c8a5bc6 fix next question placement/style
- ee4e25c4 clean up random print statements
- 9f0fd727 Update pgcli
- 8b5d7752 Update lock files
- 5fe4ca7c Add citation links
- 7854735b Add source filter
- 2ad0f730 Add switch for coach mode

---

## Updates since last changelog entry (2026-02-28 → 2026-03-13)

Coverage: changes merged/landed after the previous changelog update commit on **2026-02-28**, through **2026-03-13**.

### Highlights

- **Assignment visibility / date logic (issue-814):** enhanced visibility control logic and UI to support dual date display, including related plumbing (merge of the issue-814 workstream).
- **Assignment list UX:** added sorting in `AssignmentList` with persistence via `localStorage`.
- **Accessibility + theming:** WCAG AA fixes for assignment navigation links and dark-mode color adjustments.
- **Peer Instruction grading correctness:** restored `studentVoteCount` increment for sync PI grading.
- **Interactives fixes + polish:**
  - Matching: use `queuMathJax` instead of `typesetPromise`.
  - Multiple choice: ensure MathJax renders in feedback.
  - ShortAnswer: preserve event handlers when rebuilding.
  - ActiveCode: updated hotkeys/keybindings.
- **Ops / tooling:** added pre-commit configuration, updated dependencies, and bumped releases (**7.11.18**, **7.11.19**) with assorted bugfixes; also updated `pgcli`.

### Commit notes (for reference)

- 7f2ec9c8 update - bugfixes
- 7375c073 Release 7.11.18
- e02df4fd update pgcli
- 5cfa6569 ShortAnswer: preserve event handlers when building
- 67e6d21e CSS: override bootstrap summary styling
- 6c5fe9ea Fix: make sure to render mathjax in mchoice feedback
- d78bebb1 Matching: use queuMathJax instead of typesetPromise
- ffaf9192 fix activities required for new logic
- b2e38cd9 issue-814 Enhance visibility control logic and UI to support dual date display
- 70ff1e55 issue-1145 Implement sorting functionality in AssignmentList with localStorage persistence
- 5815b226 issue-814 Rename created_date to updated_date in assignments and related components
- f2581a22 Update activecode keybindings
- 65e2bca3 Add pre-commit configuration and update dependencies in pyproject.toml
- 27cb3b60 restore studentVoteCount increment for sync PI grading
- cfa3ea2a WCAG AA fix for assignment nav links
- 7ec65dae WCAG AA fix for darkmode grayToWhite

---

## Updates since last changelog entry (2026-02-21 → 2026-02-27)

Coverage: commits from **2026-02-21** through **2026-02-27** (i.e., changes after the prior cutoff on 2026-02-20).

### Highlights

- **Learning clues (prototype) + student context improvements:** initial prototype of “learning clues” integration landed, plus follow-on work to add context and automate lookup of book ids (primarily in `assignment_server_api/routers/student.py` and `bookfuncs.js`).
- **Peer/LLM chat robustness:** improvements to async peer messaging (prompt + behavior), fixes for message ordering, and a key fix so the correct API token field is used and LLM peer lookup can retrieve keys at call time.
- **LTI1p3 UX:** better messaging when an LMS rejects access to an **expired course**.
- **UI theming iteration:** dark-mode dropdown styling changes were introduced and then reverted (net effect: continued iteration/experimentation in this area).
- **Code quality + dependencies:** a broad pass fixing **Black/Ruff** issues and updating lock files / dependencies.

### Commit notes (for reference)

- 1a181c81 Initial prototype of learning clues integration
- 3f42fae0 log todos
- 5964439a Add context and automate lookup of book ids
- c523c054 Fix API token field selection + make LLM peer lookup retrieve keys at call time
- 8e375a9c Fix message ordering in async peer chat display
- c34931a8 update prompt and async peer messaging
- bde25ecd LTI1p3: better message when LMS rejects accessing an expired course
- eca2ee17 fix dark mode for dropdown menu…
- cacd4e49 Revert "fix dark mode for dropdown menu…"
- 968f1cd9 Fix all black errors
- 0b40954b Fix all black and ruff issues

---

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
