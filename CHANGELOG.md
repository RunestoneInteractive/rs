# ChangeLog

## Updates since last changelog entry (2026-06-26 → 2026-07-07)

Coverage: changes landed after the previous changelog update on **2026-06-25**, through **2026-07-07**.

### Highlights

- **jQuery removal from interactives (major):** removed jQuery from activecode, parsons, dragndrop, video, webwork, tabbedStuff (native tab switching), groupsub (also select2), selectquestion, timed assessment, showeval (rebased on the 0.10.0 core), and the common modules (deleting dead jQuery plugins); pages that don't need jQuery no longer load it. Added a vitest suite for activecode plus shortanswer/dragndrop tests (bbe95719, 7a5026b3, 18eca441, ab9bc4b3, fdd4f724, fbf09fcc, cc193cd0, dedb0192, 250b0879, 095dedf8, 42cb89c2, 2751ec8f).
- **Bootstrap removal / frontend slimming (major):** replaced Bootstrap with a first-party `rs-core.css` + `nav.js`; removed Bootstrap from the interactives bundle and consolidated CSS variables; extracted embedded CSS/JS out of admin and auth templates into shared static files (deleting the dead `manage_tas` page); renamed the assignment-server static CSS to `assignment.css`; restored/moved `peer.css` and the timed-assessment pagination layout after the Bootstrap removal (6d4d2444, 6349428b, c1934e83, df36edb2, d9b3ad04, cbadd217, c663a948).
- **PreTeXt-based student pages (assignment server):** moved the course homepage, `doAssignment`, and `chooseAssignment` onto a PreTeXt-based `_base` template (opt-in per course); split `main.css` into ptx-based and non-ptx-based, gating some static assets accordingly and dropping hardcoded old PreTeXt CSS; added `get_jinja_templates` to load templates from multiple directories and moved `safe_join`/`construct_course_url` into `response_helpers` (3c4b3b12, b576465c, e5805185, cb00c664, 47eb62a4, 3cafb1eb, 906f11f7, 335c3f72, dba3a011, 72162a2f, 24da474d, 6f6f8e6d).
- **LTI 1.1 port to admin server (new):** added an LTI 1.1 configuration page and ported the LTI 1.1 launch from web2py to the admin FastAPI server (2d579e6d, 537f025b).
- **Peer Instruction A/B (continued):** store the current PI phase and reapply it on websocket reconnect (new `/current_state` endpoint); fix the A/B catch-up phase and partner list on reconnect; switch per-student phase to use `assignment_id`; extract A/B verbal-cluster splitting into a testable helper (a52bc08c, 365f0be7, 3c1708ed, 612acda2, 28f95237, 7a3be60a).
- **Email (new + fixes):** send a welcome email to the instructor on course creation; get Mailgun API sending working and fix missing email-API settings (56255d26, 890e2c8c, 1841bbed).
- **Grading / gradebook:** added a late-work popup to the instructor gradebook and a `has_late_submission` helper; removed visible references to the `is_submit` assignment status; fixed a no-score regression (381bd5bd, 1fba673a, 1499cc28, 9419377e).
- **Traceback monitor:** added a `tbm` command with better local-variable storage, post-body capture, and p/q field popups; capture the raw body for all POST types (3299e2af, 8184da27, 29d326e1, 4de398e2).
- **Library / exercise builder:** added search to the library and fixed the assignment table actions-cell markup; fixed JSON-import bugs in the exercise builder (e112d748, 9fae69a5, 98f1ff18).
- **StudyClues / dark mode:** fixed the StudyClues TOC error and dark-mode colors; taught `timed.js` to handle dark mode (eb0fc14d, e2e791a2, d56dbf12).
- **Timed assessments:** eliminated the timed refresh loop and cleared `timed-hidden` on score reveal (69081688, 86bbe9bc).
- **Auth:** redirect an already-logged-in user to their course, and redirect old login/register attempts (d39d0dd3, b55b2f5b).
- **DB / infra:** `fetch_assignment_questions` now returns chapter and subchapter with each question (callers updated); fixed a telemetry check-in duplicate-key race with an atomic upsert; uv build updates (a99c5f8b, fbb80311, 16d649f1, 012bf610).
- **Docs:** new chapter and architecture-overview diagram for the assignment builder/grader React app; silenced SQLAlchemy `declared_attr` warnings during doc builds; added `UV_ENV_FILE` info (f302e829, 40e6d83a, e97fd719, 9803f25f).
- **Releases:** versions **8.9.0 → 8.9.3** shipped; bundled runestone JS bumped through **8.1.5 → 8.1.9**.

### Commit notes (for reference)

- bbe95719 feat: remove jQuery from activecode components; add vitest test suite
- 7a5026b3 feat: remove jQuery from parsons component
- 18eca441 feat: remove jQuery from dragndrop; add shortanswer + dragndrop tests
- ab9bc4b3 feat: remove jQuery from video component
- fdd4f724 feat: remove jQuery from webwork component
- fbf09fcc feat: remove jQuery from tabbedStuff; own tab switching natively
- cc193cd0 feat: remove jQuery and select2 from groupsub
- dedb0192 feat: remove jQuery from selectquestion component
- 250b0879 feat: remove jQuery from timed assessment component
- 095dedf8 feat: remove jQuery from showeval; base it on the 0.10.0 core
- 42cb89c2 feat: remove jQuery from common modules; delete dead jQuery plugins
- 2751ec8f feat: stop loading jQuery on pages that don't need it
- 6d4d2444 feat: replace Bootstrap with our own rs-core.css and nav.js
- 6349428b Remove Bootstrap from interactives bundle; consolidate CSS variables
- c1934e83 refactor: extract embedded CSS/JS from admin templates into shared static files
- df36edb2 refactor: extract embedded CSS/JS from auth pages; delete dead manage_tas
- d9b3ad04 Rename assignment-server staticAssets CSS to assignment.css
- cbadd217 restore and move peer.css
- c663a948 Restore timed assessment pagination layout after Bootstrap removal
- 3c4b3b12 Move course homepage to ptx-based _base
- b576465c Move doAssignment and chooseAssignment to ptx-based _base
- e5805185 Require opt in for ptx-based student pages
- cb00c664 Split main.css into ptx-based and not
- 47eb62a4 Gate some static_assets to not apply in RS pages using ptx-based _base template
- 3cafb1eb Drop hardcoded old pretext css from static_assets
- 906f11f7 Add get_jinja_templates to load templates from multiple directories
- 335c3f72 Move safe_join and construct_course_url to response_helpers
- dba3a011 Move macro_with_errors to editlibrary (only consumer)
- 6f6f8e6d Handle boolean or string is_instructor in existing templates
- 2d579e6d Add LTI 1.1 configuration page to admin server
- 537f025b Port LTI 1.1 launch from web2py to the admin server
- a52bc08c store current phase + add /current_state endpoint
- 365f0be7 reapply current PI phase on websocket reconnect
- 3c1708ed Fix A/B catch-up phase and partner list on reconnect
- 612acda2 per-student phase to use assignment_id
- 28f95237 Extract A/B verbal-cluster splitting into testable helper
- 7a3be60a Rebase onto main and apply fix inside split_ab_conditions
- 56255d26 feat: send welcome email to instructor on course creation
- 890e2c8c Fix: get mailgun API sending working
- 1841bbed fix: missing settings for email api
- 381bd5bd Add late-work popup to instructor gradebook
- 1fba673a Add has_late_submission grading helper
- 1499cc28 Remove visible references to is_submit assignment status
- 9419377e fix regression for lack of score
- 3299e2af Add tbm command
- 8184da27 Better store of locals for traceback monitor
- 29d326e1 Add post_body capture and p/q field popups to traceback monitor
- 4de398e2 Fix: get raw body for all post types
- e112d748 Add search to library
- 9fae69a5 Fix assignment table actions cell markup
- 98f1ff18 Fix JSON-import bugs in exercise builder
- eb0fc14d Fix: error on toc for studyClues
- e2e791a2 Quick fix of colors for dark mode / studyClues UI
- d56dbf12 Update timed.js to handle dark mode
- 69081688 Eliminate the timed refresh loop
- 86bbe9bc Clear timed-hidden on score reveal; assert fullwidth class in test
- d39d0dd3 Fix: redirect user to course if already logged in
- b55b2f5b redirect old login/register attempts
- a99c5f8b DB: fetch_assignment_questions returns chapter and subchapter with question
- fbb80311 Explicitly unpack fetch_assignment_questions results in existing code
- 16d649f1 Fix telemetry check-in duplicate-key race with atomic upsert
- 012bf610 uv updates for build
- f302e829 docs: add chapter on the assignment builder/grader React app
- 40e6d83a docs: add architecture overview diagram to the assignment builder chapter
- e97fd719 docs: silence SQLAlchemy declared_attr warnings during doc builds
- 9803f25f Add UV_ENV_FILE info to docs

## Updates since last changelog entry (2026-06-12 → 2026-06-25)

Coverage: changes landed after the previous changelog update on **2026-06-12** (which covered through 2026-06-11), through **2026-06-25**.

### Highlights

- **Poetry → uv migration (major, tooling):** migrated the monorepo from poetry to uv — repo-root dev environment plus `book_server`, `assignment_server`, `author_server`, `admin_server`, `rsmanage`, and `w2p_login_assign_grade`, and `interactives` (JS-release-only, no Python wheel). `build.py` now supports uv builds; CI and docs updated; stale `poetry.lock` files removed; reformatted for black 25.12.0 (a42c7f90, dc528ac5, 6719210e, 79c1cf48, 87ccd3c0, 07f1b2ab, 8e229f28, 70a53a8d, bdc660b7).
- **Caddy reverse proxy (new):** added Caddy as an HTTPS-capable alternative to nginx, matching nginx's custom access-log format, wired into the bake file, with a bare-`/author` redirect fix (adf37dd9, 73b1f056, 4d95f2e6, fdade39f, 7ab54973).
- **Server security hardening (several fixes):** from the server security audit — SSRF protections on the image proxy (e24a0e3d); authenticated the peer-chat websocket and `send_message` (a9410736); required instructor + course ownership for `new_assignment_q` (e1926311); scoped instructor assignment/question endpoints to the caller's course (c72bcf45); disallowed `course_students` on base courses (e9f51d3c).
- **web2py retirement (continued):** removed the old Peer Instruction controller/views (ce34b84d); retired most of the web2py admin controller — 32 endpoints plus orphaned views — keeping only grading, Manage Practice, and the Editorial Page, and added `GET /admin/instructor/source_assignments` for Copy Assignments (047241e5); ported `getassignmentgrade` and `broadcast_code` off the ajax controller to the assignment server (a8e2b694); removed other unused controllers/endpoints (f1c2e7db); ported the student report to FastAPI (7777b3aa).
- **Interactives i18n (major):** added a dependency-free `rsi18n` and migrated activecode, fitb, mchoice, parsons, hparsons, and dragndrop off `jquery.i18n`, then removed the vendored jQuery i18n files (e4694b71, 3b2c2930, d3a1bd7d).
- **Interactives question authoring + formatting:** added JSON and XML question representations to dragndrop (sharing a common XML converter base) and introduced an interactives prettier config with a first-pass format of first-party JS (1222b45e, a77296a9, 39186b0d).
- **New user menu + Tabler icons:** new JS-built user menu for PreTeXt books; replaced Material icons with Tabler equivalents across the UI; shared the navbar between `_base` and auth templates (5e672911, 672b561b, bf9b3cf4, 20f20818, 9742715b).
- **Peer Instruction (A/B testing + Likert):** added A/B testing of chat modes with group assignments persisted to `user_experiment`, plus graph fixes (instructor vote no longer counted toward the chart); added opt-in Likert reflection to async PI with logging (fc19afcd, a8cdcb59, cfc8c24f, ff120cf3, 1ddbac12).
- **Parsons / hparsons:** source/answer area sizing fixes; replaced jQuery with vanilla JS in `initializeInteractivity`/`initializeAreas`; vendored the micro-parsons-element source into hparsons (a mathjax-performance change was reverted) (021d9a7e, 54517146, 91850ca3, fd0bae97, ec3aa4f4).
- **Infra / DB:** persist basic-profile PostgreSQL data on a named volume; added a compose-version preflight guard and `init_runestone.sh` update flow (93c7166d, f551282a).
- **Type checking:** fixed type/runtime bugs in `rsmanage` surfaced by `ty`, plus additional ty-analysis fixes (64880c16, 01a65120).
- **f-1220 "Huge summer update":** large styles/grading/tests pass merged from a long-running branch, including accessibility-check refactors (7734847f, b9020f01, 9b01ac24).
- **Content / misc:** added new StudyClues books and better knowledge sourcing (18392764, 7b6c7fd0); fixed the Runestone API-keys page showing two keys when only one was added (#1135, d5f761f8).
- **Releases:** versions **8.7.5** and **8.8.0** shipped; bundled runestone JS bumped through **8.1.2 → 8.1.4**.

### Commit notes (for reference)

- a8e2b694 Port getassignmentgrade and broadcast_code off the web2py ajax controller
- 047241e5 Retire most of the web2py admin controller
- ce34b84d Remove old PI endpoints and views
- c72bcf45 Scope instructor assignment/question endpoints to the caller's course
- a9410736 Authenticate peer-chat websocket and send_message
- e1926311 Require instructor + course ownership for new_assignment_q
- e24a0e3d Add SSRF protections to the image proxy
- e9f51d3c disallow course_students on base courses
- f1c2e7db Remove unused controllers and endpoints
- 7777b3aa port studentreport to FastAPI
- 20f20818 Add icons to the user menu
- 672b561b Replace Material icons with Tabler equivalents
- bf9b3cf4 Use icons from Tabler project
- 9742715b Share navbar between _base and auth templates
- 5e672911 New user menu for PreTeXt books - built in js
- a77296a9 Add XML question representation to dragndrop; share XML converter base
- 1222b45e Add JSON question representation to dragndrop; add interactives prettier config
- 39186b0d Apply prettier formatting to interactives first-party JS
- 3b2c2930 interactives: migrate activecode, fitb, mchoice, parsons, hparsons off jquery.i18n
- e4694b71 interactives: add dependency-free rsi18n, migrate dragndrop off jquery.i18n
- d3a1bd7d remove jQuery i18n files
- 1ddbac12 Add Likert reflection to async PI (opt-in per course) with logging
- fc19afcd ab testing
- cfc8c24f persist ab group assignments to user_experiment table
- ff120cf3 fix bug where instructor vote was counting towards chart
- fd0bae97 Vendor micro-parsons-element source into hparsons
- 91850ca3 Replaced JQuery with JS in initializeInteractivity(), initializeAreas()
- 021d9a7e Fix Parsons source area sizing
- adf37dd9 Add Caddy reverse proxy as an HTTPS-capable alternative to nginx
- 4d95f2e6 Add caddy to the bake file
- 73b1f056 caddy: match nginx's custom access-log format
- a42c7f90 Convert repo root from poetry to uv (dev environment)
- dc528ac5 PoC: convert book_server from poetry to uv/hatchling
- 6719210e build.py: support uv builds; convert assignment_server to uv
- 79c1cf48 Convert author_server to uv
- 87ccd3c0 Convert admin_server, rsmanage, w2p_login_assign_grade to uv
- 07f1b2ab Convert interactives to uv (JS-release-only, no Python wheel)
- 8e229f28 Update CI and docs for the poetry -> uv migration
- 93c7166d Persist basic-profile PostgreSQL data on a named volume
- f551282a Add compose-version preflight guard and init_runestone.sh update flow
- 64880c16 Fix type/runtime bugs in rsmanage surfaced by ty
- 7734847f f-1220 Huge summer Update (styles, grading, tests)
- d5f761f8 Fix #1135: Runestone Issue: API keys shows two keys when only one added
- 18392764 Add new books for StudyClues
- 430de569 update version to 8.8.0
- 91ce1aea update version to 8.7.5

## Updates since last changelog entry (2026-06-03 → 2026-06-11)

Coverage: changes merged/landed after the previous changelog update on **2026-06-04** (which covered through 2026-06-02), through **2026-06-11**.

### Highlights

- **Anonymous usage telemetry (new, major):** self-hosted book servers now send a small, anonymous, **opt-out** weekly check-in to runestone.academy so the project can count installs worldwide and the books they serve. The payload contains no personal data and no IP-based location — only a random per-install id, the version, a self-declared region/institution, the base courses served, and bucketed counts. Adds a `POST /telemetry/checkin` receiver on the admin server, a `rsmanage telemetry` preview/send command, settings + migration (`telemetry_state`, `installation` tables), and disclosure in the README and `sample.env`. Disable with `TELEMETRY_ENABLED=false` (fdf4a1f8).
- **Auth/account pages on the admin server (continued migration):** ported the **donate** page to the FastAPI admin server, styled to match the other auth templates, and shown after a student registers for a new course (574be591); reworked **My Courses** to sort by most-recent access with a ⏱️ marker for courses used in the last 30 days (607259f0); re-themed the auth templates from the old red/magenta to the instructor/student blue scheme (PR #1234); updated auth-related links (PR/update-links, 320bba0b).
- **CodeTailor security (fixes):** fixed CodeTailor security vulnerabilities and addressed review follow-ups (9656a057, 8b706064, 8bf3720d, fcd5a392); added a fallback to a static backup Parsons problem when a course has no API token (PR #1230, 4f549552).
- **Peer Instruction polish (continued):** sync PI feedback fixes, round two (PR #1228, 8753c43e); retain the vote count from the first vote during the second vote (6943c8cd); updated peer paths (c6c2b3b3); removed unused `displayPeers`/`groupList` code (bbe62613).
- **StudyClues:** fixed "login to StudyClues suddenly stopped working" (38aabe33); added a StudyClues course (e75e8e67).
- **Dashboard:** added Prism CSS for line numbers and removed the custom line-number rendering on the dashboard (b91e918b, 8ef075ae).
- **Build / tooling:** baked the release version into the book and rsmanage Docker images (`RUNESTONE_VERSION` build-arg → env) so telemetry reports the tagged version; fixed the build's wheel phase to derive a service's project directory from its Dockerfile location rather than the Docker build context, so services that use a repo-root context (e.g. rsmanage, to bundle `migrations/`) are no longer skipped (both in fdf4a1f8); fixed a migration (fa3b9022).
- **Releases:** versions **8.7.2** and **8.7.3** shipped during this period.

### Commit notes (for reference)

- c6c2b3b3 update peer paths
- 66c66305 update version
- fdf4a1f8 Add anonymous opt-out usage telemetry (install check-in)
- b80be7c3 Merge branch 'update-links'
- 320bba0b Update auth related links
- 574be591 Port donate page to admin server and show it after new enrollment
- 1f3cfd0d update version to 8.7.3
- 880c30b5 Merge pull request #1231 from aspadiyath/main
- e14a21f6 Merge pull request #1230 from aspadiyath/codetailor-backup-parsons-fallback
- 71860ebc Merge pull request #1228 from sethbern/sync-pi-feedback-v2
- d70d834d Merge branch 'my-courses-sort': recent-access sort + ⏱️ for my_courses
- 607259f0 Sort my_courses by recent access and flag recently-used courses
- 43a1bdd4 Merge pull request #1234 from RunestoneInteractive/auth-blue-theme
- d10d54ff Match auth template color scheme to instructor/student blue
- bbe62613 remove unused displayPeers and groupList code
- 8b706064 Address Copilot review comments on CodeTailor security PR
- 9656a057 Fix CodeTailor security vulnerabilities
- 6943c8cd retain the count on the first vote during the second vote
- 8ef075ae remove custom line numbers from dashboard
- b91e918b add prism css for line numbers
- e75e8e67 Add course for studyclues
- 4f549552 Fallback to static backup Parsons when course has no API token
- 8753c43e sync pi fixes from feedback
- fa3b9022 Fix migration
- 38aabe33 Fix for "login to studyclues suddenly stopped working"
- 598de66d update version to 8.7.2

## Updates since last changelog entry (2026-04-02 → 2026-06-02)

Coverage: changes merged/landed after the previous changelog update commit on **2026-04-02**, through **2026-06-02**.

### Highlights

- **Peer Instruction overhaul (major):** migrated all sync PI routes to FastAPI; added async PI student page, per-question toggle for async/LLM mode, analogies async mode, live percent-correct polling for instructors, and a `toggle_async` endpoint wired to the instructor dashboard. Multiple UI/UX polish passes landed, including async PI vote-2 feedback, step banner clarity, and a corrected async-mode DB migration (`async_mode` column replaces `use_llm`). Peer grading logic brought in line with the web2py version (PR #1209, PR #1226).
- **Analytics & reporting (new):** added a Chapter Summary Report with student drilldown, an Assignment Summary Report, and a new Activity Report menu entry — all under the admin analytics server. Fixed inflated click/attempt counts in the student drilldown; fixed routing for `/admin/analytics`; fixed missing `course_list` and sample-size handling.
- **Gradebook:** restored old gradebook functionality (84cc2edc); landed new interface for reviewing and grading student work (issue-998 / PR #1218).
- **CodeTailor / AI features:** added per-exercise toggle to disable CodeTailor personalization (PR #1213); improved dropdown labels for clarity (PR #1208); added a "principles" section to the coach; rendered StudyClues LLM responses as Markdown via `marked`.
- **Authentication migration:** added new FastAPI routes to begin moving authentication away from web2py (PR #1222).
- **Assignment Builder:** added Python 3 option to `LanguageOptions` enum; added a preview button for student assignment view in `AssignmentEdit`; refactored ActiveCode line decorations to use CodeMirror decoration functions (PR #1190).
- **Interactives cleanup + TypeScript:** restored `tabbedstuff` component (PR #1224); removed deprecated Runestone interactive components and Python Sphinx extensions; allowed interactive modules to be converted to TypeScript; added HTML ActiveCode unit tests.
- **rsmanage:** restored `rsmanage` as a standalone command (no Docker required); added migrations to the rsmanage Docker image.
- **Releases:** versions **8.6.0**, **8.7.0**, and **8.7.1** shipped during this period, along with runestone dependency bumps to 7.13.3, 7.13.4, 7.13.5, 8.1.0, and 8.1.1.
- **CI / build:** updated test runner and CI to Python 3.13; fixed stale venv cache; fixed stale lock-file issues; updated cryptography/jwcrypto library across the board; removed remaining `pkg_resources` references.
- **Docs:** documented `parsonsPersonalized` field in `question_json_schema.rst`; updated README; added Virginia Tech course.

### Commit notes (for reference)

- 23c95ad9 Update PreTeXt
- 84cc2edc Restore old gradebook functionality
- 516d61970 Merge pull request #1226 from sethbern/async-pi-feedback
- 7ddf167a0 fix async PI vote 2 feedback and UI polish
- 98601d7b Document the notify component
- 26217a19 Add pushover notifications
- a5c615f0 Fix wording on old courses
- 1e613fe9 New: Add migrations to rsmanage image
- a097f621 add migration for async_mode
- 4e3862731 update version to 8.7.1
- cda3266d Merge pull request #1217 from xinyinghou/rs-debug
- c1468fc3 Merge pull request #1209 from sethbern/peer-fastapi
- f6a12c6c update question_json_schema.rst
- 74cc2dd7 Restore rsmanage as a command without needing docker
- 1996fde4 Merge pull request #1213 from aspadiyath/feature/codetailor-example-toggle
- f0d0141b Update to python3.13 for test runner
- 4760d169 Document parsonsPersonalized field in question_json_schema.rst
- 32b5197a update CI to Python 3.13 to match pyproject.toml
- 778668182 fix stale venv cache
- 3cfd8df1 fix migration to add async_mode column; show student justification for first message in async PI
- 83d92767 fix peer grading to be in line with web2py version
- aa84fee7 fix vote details in instructor interface
- 26d14b92 update sync PI instructor view
- db1e2a0b add analogies async mode for peer instruction LLM
- ab21b878 improve asynchronous PI ui/ux
- cf5f1625 Add async PI student page
- 1aa623902 Migrate sync PI routes to FastAPI, fix nav links, and add missing endpoints
- 2e606d5e Add peer instructor extra page with live percent-correct polling
- 2244a88f Add toggle_async endpoint and wire it to the instructor dashboard
- 5ad11eeb Remove assignment to unused variable
- 3b91069f update runestone to version 8.1.1
- 42e23f1b Merge pull request #1224 from ascholerChemeketa/restore-tabbed-stuff
- cdd290d0 Restore tabbedstuff to interactives
- 34ec43ac update version to 8.7.0
- 0b075d98 update runestone to version 8.1.0
- 5b7d316e Merge pull request #1222 from morozov-av/i-1188
- e1299b20 Merge pull request #1223 from morozov-av/f-1215
- 7e47abac Add new routes to move authentication to FastAPI
- f4879572 Add preview button for student assignment in AssignmentEdit
- 089256fc Add Python 3 option to LanguageOptions enum
- 4b829bd5 Fix reference to micro-parsons code
- 2a9e9880 Add unit tests to html activecode
- 2477459d Merge pull request #1218 from morozov-av/f-998-final (grading interface)
- d0c0da1f Don't say regarding section if there isn't one
- 92971f36 Allow interactive modules to be converted to TypeScript
- 7e11a445 feature-998 Design new interface for reviewing and grading student work
- f44bd90a Fix truthy string returns masking failures in unittest evaluation
- 2e05b489 Merge branch 'principles'
- 7ed7b1ad Feature: add per-exercise toggle to disable CodeTailor personalization
- 3c963bab Remove runestone as a dev dependency
- 20e52fd2 Fix wording about dependence
- aa518802 Fix test problem with lp_component
- a84113ae Merge branch 'component_cleanup'
- 77ee3b17 Merge pull request #1208 from aspadiyath/improve-codetailor-labels
- d2100447 Improve CodeTailor dropdown labels for clarity
- f6694cf2 Add principles section
- 2bb10116 Log intermediate connections
- 810a292e ignore justfile for this project
- ed1e5d0c Update README
- 6d8c7a1b remove deprecated runestone interactive components
- c124431e Remove the python sphinx extensions
- 442f5006 remove more python code
- 35c0298e Runestone release update
- 408f0523 render StudyClues LLM responses as markdown using marked
- 2d11daef update runestone to version 7.13.5
- c9cec5e4 debug string reprs for better query checks
- aaa40e98 Avoid race condition with multiple calls to buildProg
- 9d3007ce Do not include PI assignments in list
- 1dea1290 Update cryptology library across the board
- 024103000 update runestone to version 7.13.4
- e1ede187 Fix dependency update for jwcrypto / cryptography
- 689a9a04 New: pass assignment id to assignment overview
- e1e3fcb6 update version to 8.6.0
- c87df328 Add Assignment Summary Report
- e7e81428 update runestone to version 7.13.3
- fa035b7a Add Virginia Tech course
- 83cda9a6 Merge branch 'claude/frosty-newton'
- 2238c64f Add new activity report to the menu
- 30f99ea2 Fix inflated click/attempt counts in student drilldown
- cc6602b7 fix routing for admin/analytics
- d2a55717 Add student drilldown to chapter summary report
- 0f7c4957 Add chapter summary report (subchapoverview) to admin analytics server
- 79f64a75 Fix: restore flag to prevent every keystroke from logging
- 394c0f2f Fix: missing course_list, respect entered sample size
- b78466f7 Remove references to pkg_resources
- 3d57405f Activecode: Refactor line decorations to use CodeMirror decoration functions
- 2d1f4f50 fix security check and question_json bug in async mode
- 768a30f0 Fix: base course mismatch for studyclues
- eb8fb7df Add course_attrs to eBookConfig
- 5cdee00a update phrasing of step 2 of async llm
- 02f340dd add course attribute for async LLM modes
- 37deef11 update model to add migration for use_llm column in assignment_questions
- b64345fa Merge pull request #1173 from sethbern/async-toggle
- e3564f2f Merge pull request #1190 from ascholerChemeketa/activecode-lock-display-improvement

---

## Updates since last changelog entry (2026-03-28 → 2026-04-02)

Coverage: changes merged/landed after the previous changelog update commit on **2026-03-28**, through **2026-04-02**.

### Highlights

- **New release:** tagged a new release point (7e074ed5).
- **issue-1186 / issue-1187:** removed "released" status handling from `AssignmentBuilder` and `AssignmentList` components (issue-1186); added JSON schema documentation for the `question_json` field (issue-1187).
- **Build system hardening:** added tests to the build command, introduced a `--skip-tests` flag, and fixed CI by creating stub static-asset directories before running tests.
- **StudyClues content:** added new books and courses for StudyClues.
- **JSON format docs:** added documentation for the JSON question format.
- **Bug fixes:** correctly identify sections for RST books; remove leftover debug code from course home; require bash 5.x (Homebrew) on macOS for build scripts; fix `pkg_resources` import removed from `setuptools`.
- **Ops / tooling:** black formatting fixes; added `.claude` to `.gitignore`.

### Commit notes (for reference)

- 34ff6e89 Fix: pkg_resources removed from setuputils
- ebf72281 Merge branch 'issue-1187'
- 784bb7d0 Docs for json format
- 9290dd22 Add new books and courses for StudyClues
- 70bd574d Add —skip-tests flag
- e95ffb5a Add tests to the build command
- b0b482f0 black fixes
- 7cbb8c9f Fix CI: create stub static asset directories before running tests
- 209620df Fix: remove debug from course home
- ebb11858 Fix: MacOS needs bash 5.x from homebrew
- 6fd6c056 issue-1186 Remove released status handling from AssignmentBuilder and AssignmentList components / issue-1187 Add JSON schema documentation for question_json field
- bc3e21b4 Fix: correctly identify section for RST books
- a50d6bec ignore CLAUDE
- 7e074ed5 New Release

---

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
