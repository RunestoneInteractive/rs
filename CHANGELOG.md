# ChangeLog

## Updates since last changelog entry (2026-08-20 → 2026-10-07)

Coverage: changes landed after the previous changelog update on **2026-08-20**, through **2026-10-07**.

### Highlights

- **Dash server for instructor visualizations (new):** the dash prototype was revived as `/dash/`, with background callbacks running in a new `dash_worker` service on its own Celery queue; first pages are a chapter question-outcomes chart (first-try right / right after retry / never right / never tried) and an assignment progress page, built on a new `rsptx.question_outcomes` component, and the pages share the site navbar and footer (977d0e9e, ec4d0d00, 37478793, 28116c8b).
- **Accessibility (WCAG AA):** core page colors were consolidated into design tokens with contrast and focus-visibility fixes, a main landmark added to the base templates, and the change-course, profile, legal, course-add, donate and student-report pages fixed; the VPAT was updated and added to the repo. In the interactives, dragndrop, matching, mchoice, parsons, hparsons, clickable, fitb, shortanswer and activecode all gained keyboard and screen-reader work — MathJax-rendered speech in aria labels (via a shared extraction helper), announced feedback and results, an accessible native help dialog for matching, keyboard entry hints and localized announcements for Parsons/HParsons, and labeled inputs, heading hierarchy, history position and announced output for activecode; screen-reader-only CSS classes were consolidated and MathJax queue/readiness handling was centralized in `RunestoneBase` (ef8e4772, dadc75eb, 99794f02, aecaf61c, ffc572f5, 11de3259, 993cabcd, 8237a454, 009ef5aa, a94b19bf, 9ef81bea, 4c032288, c205ae94, 1ffa1670, d88c7158, 979d90d8, 3a270015, 2527b6c5, bf884a0d, 7500631c, 32faf3a7, 91288d22, 64ce40f5, ca50920a, 553e2f9e, 99dbdffc, 6e47eb13, 06727dd0, 20acce2e, a0a05c2f, e89cd8e8, fcea52c4, 56fbca06, d906713a, 88d78241, 0732e910, b48ad76f, 31bd9586, 4bf5a39e, ff356b19, b02e0501, 9fbcc3db, 6eb65906, 33abf473, c74f734e, 8d1a10ab, 182f62a0, 5b307544, 738e9817, 6a05e648, edad6703, 1eacc3ec, 3292c0dc, 76382e22, 06a12845, 62dd7581, f360a751, dd2df19f, f2372c29, dd5d6ff1, 68fe3d1b).
- **Grader and gradebook:** the gradebook moved to a React page, students with late work are highlighted, question summary data was reworked, the manual grading view displays questions better (with a manual-grading filter, separate toolbar and MultiGradeDialog formatting), selectquestion work is shown in the grader, table page and rows-per-page are remembered, the CSV export has the username back and rows are labeled "Last, First" (d4a01592, 3ae15728, f244484d, 80a3411b, 644fc508, 181a7258, 25a47806, d366816c, f3f1faa9, 779885c3, 89ca8577, 508d63d2, 3621497b).
- **Grading correctness:** the autograder no longer overwrites a hand-entered grade, the re-grader can score readings, "all assignments" deadline exceptions apply when grading one assignment, question scores are capped at the assignment's points, the accommodation form no longer drops extra days/time limit, blank time limit/due date in exceptions are stored as NULL, quizly is graded as interaction-only, and the assignment overview SQL error was fixed and reading interactions counted (7ec6eee2, 702489db, 561ed0cf, 52204a51, cad2a741, fcfa38e8, a030c005, c9cd54f3, 07002c30).
- **LTI:** grades are pushed to the LMS when an assignment is released; instructors can repush unchanged grades (regrade from the grader forces passback, released manual totals are forced, unreleased grades are guarded during recomputes); LTI 1.3 got Blackboard debugging (later dropped to DEBUG), a `has_lti1p3_user_association` check and blank emails for associated accounts; an LTI frame resizer was added (8fe49f0e, ee5ce316, ae1b0106, 9b2d2cb6, f20e706e, 0db4357c, b68a5dd0, 5c6e6e99, 4258becc, b3826a10, 86a582e7, 7835013a, 6d92180f).
- **Assignments:** bulk edit actions on the assignment list, per-assignment randomized conditions, explicit chapter/subchapter numbers in builder pages, better exercise sorting when adding via book browse, cross-course doenet assignments, and assignment links no longer open in the wrong course (69f4c44d, 55bcd4ea, d10ecaa6, 1eb4308c, 2a0508f0, 8e05c41f, e564721b, ebe4c19a).
- **Question editor:** a new editorial (JSON) interface for questions that keeps the rendered HTML in sync with edits and handles older questions without `question_json` (d591ba46, 16df9d38, 2b66ce7d, b069d17e, 3a439fda, 1608dcc9).
- **Peer instruction:** async PI fixes, LLM calls routed by token provider, `visible_on`/`hidden_on` honored, the first vote stays visible after the second, duplicate vote2 submissions fixed, the peer-chat websocket no longer reconnects in a loop on session expiry, and impersonation/student-control access was locked down (eee5daed, 35d10da7, 8c7f18f7, 621141e0, a326aa5a, 3bb1774c, 3b247ed6, 929b8702, 35ccbc64, 1e673ad0).
- **Security hardening:** cross-site state-changing requests carrying the auth cookie are blocked, compare-me results and attachment lookups are scoped to the caller, untrusted data is escaped in interactives `innerHTML` sinks, password validation was strengthened, and invalid JSON is handled gracefully (47b20729, 833e40d6, bd10d724, c5282b15, 1c71e0b5, 052d778c, cf39a7fa, 71774a12).
- **Performance / connection pooling:** the connection pools no longer run dry, the book server stopped blocking its own event loop, admin analytics reports run off the event loop, `doAssignment`, `/assessment/results` and instructor checks were sped up, and `user_courses.last_access` replaces useinfo scans; added `watch_pool_monitor.py` (bf5a951b, 621e3cbf, ad116f5c, 08d2211f, a162deba, 128d190c).
- **CodeTailor / Parsons:** fixed asymmetric block indentation, raw markup and HTML entities leaking into the LLM pipeline and clipboard, def/return/import detection, mangled comparison operators, and question lookup in cloned courses (8861f74f, 6b34e466, e0adacf2, 313e8c97, 317783ae, 461b3891, 6e92d260, 7028ecd3).
- **Activecode binary files:** `source_code.is_binary` with migration, delivery of binary files to the server working directory, and per-language wiring of binary compile-also files (19be6d41, c3e0ab08, 38395e4f, d17ee167, 7b19d020).
- **Problem reports:** reporters can file under their own GitHub account, email is included, and the console log is always persisted to sessionStorage (6312e90e, 83b0e7aa, c7b5b97b).
- **Course & student experience:** term start date clarified, with a warning when students are in the book before it and a rewritten progress container; course name in the user menu; a typed course name wins over a picked book at enrollment; Material Symbols font self-hosted without clobbering PreTeXt's; PSA ads restored for PreTeXt books; StudyClues gated on a course attribute with response logging; assignment-download timestamps shown in local time (2f8cbe01, a9a0ea05, ab889db9, b6bf343c, 22e13cbd, 036aa25b, 614afe81, 4c499566, 1946fc04, f0ab9408, 03e0c3fe, 56b49c34, 76de0396, 0ef95cd0, a668a613).
- **Books / builds / manifest:** fixed manifest titles containing markup and chapter numbers in titles, page-question IntegrityErrors on rebuild (with `dedup-page-questions`), duplicate images in the bake process, and webwork JS on assignment pages with PreTeXt templates; subtitles are searchable (3d297678, 00c5850a, 5e056d04, ce1bad13, b9f5007e, 1d69b4ac).
- **Tooling & ops:** Python 3.14 (minimum 3.13), docker-compose env blocks consolidated into YAML anchors, `rsmanage courseinfo --students`, rsmanage prompts fixed in Docker, scripts to copy questions between base courses and to seed PTXSB demo students, the release command prints latest GitHub releases, eslint/ruff fixes, and new fall courses/books added (75477c67, 95a783e6, b021c429, 90bd2a8c, 626408d9, 154b5ee5, dba9a2d3, 6ee1b5dc, 4265e626, c4953bf2, a4bf0646, cbc843fc, 9d3869e2, d68d8f47).
- **Releases:** app versions **9.0.10** through **9.3.3** shipped (including 9.1.0, 9.2.0 and 9.3.0); bundled runestone JS bumped **8.2.7 → 8.3.4**.

### Commit notes (for reference)

- 00c5850a Do not include chapter numbers in title when processing runestone-manifest
- 1eb4308c CRUD: include chapter numbers in fetch_questions
- 2a0508f0 Assibment builder - add explicit chapter/subchapter numbers to builder pages
- 72caf6c3 added required save_code choice
- dba9a2d3 Add script to copy questions between base courses
- ef8e4772 Consolidate core page colors and initial audit for WCAG
- dadc75eb Add main landmark to _base and _auth-base
- 99794f02 Fix accessibility issues with change course select
- aecaf61c Fix accessibility issues on profile page
- e4846914 Remove login help link to blog
- 8fc0406e Mark auth/profile as student_page
- ffc572f5 Fix accessibility on legal & compliance
- 11de3259 Fix accessibility issues on course add and donate pages
- 993cabcd Fix accessibility issues on student report
- a030c005 Grade quizly as an interaction-only question type
- 8237a454 WCAG AA contrast and focus-visibility fixes
- 009ef5aa Update VPAT for the August 2026 accessibility work
- a94b19bf add vpat to repo
- 29bcee1f update runestone to version 8.2.7
- 8e05c41f Improve sorting of exercises when adding to assignment via book browse
- 3999ff0b Potential fix for pull request finding
- e564721b enable cross-course doenet assignments
- a4696815 add migration for existing builds
- 46afbef9 update version to 9.0.10
- 4265e626 Get and print the latest releases on github
- 9ef81bea Dragndrop: fix issues in keyboard navigation
- 4c032288 Matching: improve keyboard navigation
- c205ae94 Interactives common: Add mathjax aria extraction helper
- 1ffa1670 Dragndrop: add mathjax rendered speech to aria-labels
- d88c7158 Matching: use rendered mathjax in aria labels
- 979d90d8 Matching: results announced by screen readers
- 3a270015 Matching: include box status (correct/incorrect) in aria label
- 2527b6c5 Matching: convert help to accessible native dialog
- d1545b6c remove iframe migration
- 488cdc08 Updates for studyClues
- 5d335216 ignore the notes folder
- bf884a0d Mchoice feedback screen reader fixes
- 7500631c Mchoice legend move to top of fieldset
- 32faf3a7 Mchoice: use mathjax generated text for accessible labels
- 8861f74f Fix CodeTailor Parsons puzzle asymmetric block indentation
- 9f8f1a12 Matching: fix timing issue for rendering dragables with mathjax content
- 00871f5a Better handling of an empty 200 response
- c163cf46 Matching: copy mathjax to connection report
- c07382d7 Matching: fix timing edgecase
- 91288d22 Shortanswer: add aria-live to feedback area
- 64ce40f5 Shortanswer: change unlabeled fieldset wrapper to div
- 1d69b4ac Make subtitle searchable
- e0adacf2 Fix CodeTailor raw Parsons markup leaking into LLM pipeline and clipboard
- 317783ae Fix def/return and import detection in Parsons block aggregation
- 83b0e7aa Add email to problem reports
- cbc843fc Add Duke’s fall course
- eee5daed async PI fixes
- ca50920a Clickable: keyboard navigation improvements
- 6b34e466 Fix asymmetric Parsons block indentation from leading trim()
- 313e8c97 Fix HTML entities leaking into CodeTailor clipboard copy
- 7bbb554f fix check me issue
- 75570d0b update runestone to version 8.2.8
- e9241f43 update version to 9.0.11
- 9d3869e2 Add books for Jan
- 14f39d9a update runestone to version 8.2.9
- 446bdecf update lock
- 461b3891 Fix CodeTailor Parsons blocks mangling comparison operators
- 052d778c Strengthen password validation
- 4d5479c0 Matching: override PTX SVG background color
- 0305b631 update runestone to version 8.2.10
- 6e92d260 Fix CodeTailor question lookup failing in cloned courses
- 553e2f9e Parsons: render MathJax generated text into accessible label
- 99dbdffc Parsons: support screen-reader keyboard interaction
- 6e47eb13 Parsons: announce Help Me feedback inline
- 06727dd0 Parsons: show keyboard entry hint on focus
- 20acce2e Parsons: exclude disabled blocks from keyboard navigation
- a0a05c2f Parsons: localize keyboard announcements
- a668a613 Report assignment-download timestamps in the instructor's local time
- b9f5007e Ensure webwork js on assignment pages even using pretext templates
- 9a440682 apply copilot suggested fixes
- 2f8cbe01 Clarify term start date in course creation/settings
- b6bf343c Reformat progress container text
- 22e13cbd Rewrite default progresscontainer HTML
- a9a0ea05 Warn when in book before termStartDate
- ab889db9 Add eBookConfig.termStartDate to student facing pages
- 3bb1774c Stop the peer-chat websocket from reconnecting in a loop when the session expires
- f0ab9408 Fix #1475: self-host the Material Symbols font so icons stop showing as words
- 508d63d2 Fix #1477: put the username back in the gradebook CSV export
- 3621497b Fix #1463: label gradebook rows "Last, First" so their order reads as an order
- d2867f1b update runestone to version 8.2.11
- 03e0c3fe Fix #1510: stop the bundled icon subset from replacing PreTeXt's font
- 3722dff7 update runestone to version 8.2.12
- 1946fc04 Fix #1489: a typed course name wins over a book the student also picked
- 95126ce3 Test the #1489 enrollment priority, and unstick the admin suite's event loops
- 626408d9 Fix rsmanage prompts in Docker by unpinning asyncclick
- 060a2f61 update runestone to version 8.2.13
- 991e45b5 update version to 9.0.12
- 9b624ac3 clear github token for release command
- 397b7b94 update version
- cf39a7fa fix: min length
- 69f4c44d Add bulk edit actions to the assignment list
- 55bcd4ea f-1193 Add bulk edit actions to the assignment list
- e89cd8e8 Make the Parsons "Enter to activate" hint harder to miss
- ebe4c19a Stop an assignment link from opening in the wrong course (#1494)
- 7ec6eee2 Stop the autograder from overwriting a hand-entered grade (#1515)
- 702489db Teach the re-grader how to score a reading (#1493)
- bf5a951b Stop the connection pools from running dry
- cfd1a631 update version to 9.1.0
- f244484d f-1252 changes to summary data for questions
- 5c6e6e99 LTI1p3: Verbose debugging for blackboard intrgration issue
- 4258becc LTI1p3: Clarify possible cause of failure to access line items
- 8df32f19 Pass CADDY_SITE_ADDRESS and CERTBOT_EMAIL from .env to admin server
- fcea52c4 Hparsons: Improve keyboard and MathJax accessibility
- 56fbca06 Hparsons: Announce feedback and reset status
- d906713a Hparsons: Cancel stale feedback announcements
- bf841001 update version to 9.1.1
- 88d78241 Hparsons: Await queued MathJax block renders
- 0732e910 Hparsons: harden activeBlock tracking
- b48ad76f Hparsons: Align keyboard application mode
- 31bd9586 Hparsons: Style keyboard application surface
- 4bf5a39e Hparsons: Space selected block outlines
- ff356b19 Hparsons: Show keyboard activation cue
- b02e0501 HParsons: Allow space key to move active block in ParsonsInput
- 9fbcc3db Hparsons: Keep reusable block IDs unique
- 6eb65906 Hparsons: Localize interface and keyboard messages
- 621e3cbf Stop the book server blocking its own event loop
- b021c429 Consolidate docker-compose environment blocks into YAML anchors
- bc5d8e49 Update date
- 779885c3 Show a selectquestion's work in the grader (#1481)
- c266518c Fix CI testing
- 6c52782c change log level of unauthenticated requests
- c4953bf2 f-0 fix eslint configuration
- dd7b3cd0 f-0 small fix
- afe13ebb f-0-fixeslint fix new files
- 8fe49f0e Push grades to the LMS when an assignment is released
- 3791b582 update runestone to version 8.3.0
- 90bd2a8c rsmanage: add --students option to courseinfo
- 602c8324 update version to 9.2.0
- d5f06bb8 update image for version checkout
- 128d190c scripts: add watch_pool_monitor.py for db pool log monitoring
- ad116f5c admin: get the analytics reports off the event loop
- b3826a10 LTI1p3: drop detailed logging to DEBUG level
- d10ecaa6 per-assignment randomized conditions
- d4a01592 f-1255 migrate the gradebook to a react page
- 3f20c9ab report caller on IntegrityErrors
- 33abf473 fitb: make the blanks readable to a screen reader
- 6d92180f Add lti frame resizer
- d68d8f47 Add virginia tech course
- 0e7bda5f f-1255 fix lint
- 89ca8577 Remember table page and rows per page (#1532)
- 7028ecd3 Trip extra whitespace from front of blocks
- 929b8702 Patch student control access
- 1c71e0b5 Patch innerHtml on user input
- bb464b93 Change HTTPException to JSONResponse
- 28a78f70 f-1255 toolbar ui fix
- 6312e90e Let reporters file problem reports under their own GitHub account
- 1005265b Remove snark
- 51a81a88 Fix excel doc too.
- 9fc0f678 update version to 9.2.1
- fcfa38e8 Store blank time_limit/due_date in save_exception as NULL
- d591ba46 f-1257 add Editorial interface for questions
- 3a439fda f-1257 fix lint
- 76de0396 Gate StudyClues widget on the studyClues course attribute
- 8c7f18f7 Honor visible_on/hidden_on in peer instruction pages (#1462)
- e87babd4 update runestone to version 8.3.1
- 036aa25b Add course name to user menu
- 62dd7581 MathJax: settle readiness after load failures
- f360a751 RunestoneBase: centralize MathJax queue handling
- dd2df19f Interactives: rely on settled MathJax queue
- 35ccbc64 Move control check
- 71774a12 Gracefully handle invalid json
- f2372c29 Improve MathJax readiness handling
- 59cd0b31 Change to != for future-proofing
- 3ae15728 f-1275 highlight users with late work in the grader
- 69f953c4 oops: remove test title
- 64de1491 Change to hincrby
- 3b247ed6 Prevent impersonation
- 1e673ad0 read back the assigned condition
- e4acd99b Move guard outside of try
- 7913e376 Add type to bare except
- 6a2e5353 Updates for latest sqlalchemy reqs
- fe047e0d update runestone to version 8.3.2
- ac101e4f update version to 9.2.2
- 2b66ce7d f-1257 fix editing for old questions without question_json
- 1608dcc9 f-1257 fix test
- 35d10da7 route async PI LLM calls by token provider
- 614afe81 PreTeXt template needs course_name for menu
- 4c499566 back fill providing course_name
- cad2a741 Fix accommodation form dropping extra days / time limit
- 621141e0 Keep the first vote visible after the second
- 56b49c34 Restore PSA ads for PreTeXt books.
- 19be6d41 Add is_binary to source_code
- c3e0ab08 Add is_binary migration, crud, and endpoint tests
- 38395e4f Deliver binary files to the server working directory
- d17ee167 Wire binary compile-also files into the build per language
- 7b19d020 Add binary file tests for datafile and livecode
- 16df9d38 f-1257 Keep rendered question HTML synchronized with editorial JSON edits
- a162deba Track last course access on user_courses instead of scanning useinfo
- 034c4a5f update dependencies
- c74f734e ActiveCode heading hierarchy respects context
- 8d1a10ab Associate ActiveCode inputs with labels
- 182f62a0 Announce ActiveCode format and download actions to screenreaders
- 5b307544 ActiveCode output improvements for screenreaders
- 738e9817 Make Activecode history 1 indexed and report full position to screenreaders
- 6a05e648 Make Activecode save and run hotkey trigger accessible output
- edad6703 Activecode: surpress aria-live output for autorun programs
- 1eacc3ec Consolidate screen reader only css classes
- 3292c0dc Activecode: accessibility improvements for unit test results and sql query results
- 977d0e9e Add the dash server to the composed app with a question outcomes chart
- 561ed0cf Apply "all assignments" deadline exceptions when grading one assignment
- ec4d0d00 Add an assignment progress page to the dash server
- 37478793 Give the dash pages the site navbar and footer
- 28116c8b update menu
- b069d17e f-1257 fix html regeneration
- 08d6557b update version to 9.3.0
- ce1bad13 fix bake process for duplicate images
- 68fe3d1b Fix button label color
- 0ef95cd0 log responses and mode from studyClues
- 95a783e6 Set minimum python at 3.13 not 3.10
- 9f4f7d08 update runestone to version 8.3.3
- 701ab328 update pxx
- 76382e22 Activecode: announce that document is rendered for lang=html
- 06a12845 Activecode: screen reader improvement for slow compiling programs
- dd5d6ff1 Donate promt dark and accessibility fixes
- 80a3411b f-1563  improve the display of questions in the manual grading interface
- ee5ce316 Regrade from grader needs to apply force=True to lti helper
- 0ab60e6a better reset — when switching branches
- a326aa5a Fix issue with multiple vote2 votes getting sent.
- 2d24768c update version to 9.3.1
- 3d297678 Fix manifest titles containing markup
- 86a582e7 Add has_lti1p3_user_association check
- 7835013a Allow blank emails for LTI1p3 associated accounts
- 79c686dd Poll instead of sleeping in activecode announcement tests
- 07002c30 Fix assignment_questions crash when a subchapter is not in the toc
- 75477c67 Update to use Python3.14
- 644fc508 f-1563 add MultiGradeDialog formatting
- f804f843 update version to 9.3.2
- 181a7258 f-1563 fix Matching type
- dab5604d document parsons answer format
- 7cf6ad94 Fix profile email tests: session loop scope and optional email form field
- ae1b0106 Allow instructors to repush unchanged grades via LTI
- 9b2d2cb6 Update force parameter logic in regrade function
- f20e706e Update test_regrade_batch to Force send
- 0db4357c Guard unreleased grades during instructor LTI recomputes
- b68a5dd0 Force LTI passback for released manual totals
- 5e056d04 Fix page question IntegrityError on rebuild; add dedup-page-questions
- 47b20729 Block cross-site state-changing requests that carry the auth cookie
- 25a47806 f-1563 fix parsons view
- 154b5ee5 Fix rsmanage dependency
- c5282b15 replace unsafe use of innerHTML with innerText
- d366816c f-1569 add manual grading filter
- f3f1faa9 f-1569 create separate toolbar
- bd10d724 Escape untrusted data in interactives innerHTML sinks
- 833e40d6 Scope compare-me results and attachment lookups to the caller
- a4bf0646 help ruff find imports
- c55d051c order imports
- 409f22fc fix import order
- c9cd54f3 Fix assignment overview SQL error and count reading interactions
- 6ee1b5dc Add script to seed PTXSB with six students and Demo Assignment work
- a6ddf6f6 update runestone to version 8.3.4
- bafc10a7 update pxx
- d34c60d0 update version to 9.3.3
- c7b5b97b Always persist console log to sessionStorage for problem reports
- 08d2211f Speed up doAssignment, /assessment/results, and instructor checks
- 52204a51 Cap question scores at the assignment's points

## Updates since last changelog entry (2026-08-02 → 2026-08-19)

Coverage: changes landed after the previous changelog update on **2026-08-02**, through **2026-08-19**.

### Highlights

- **web2py is gone (9.0.0):** the web2py server was removed from the monorepo (945 files, ~231k lines); unclaimed URLs now route to a new admin front door instead of web2py, `accessIssue` was replaced by a real sign-in-required page, LTI 1.1 launches were moved off the retired web2py destinations and w2py session info was dropped from LTI logins; the build and dev tooling no longer depends on web2py, `WEB2PY_CONFIG` became `SERVER_CONFIG`, unreferenced legacy assets were dropped from `staticAssets/js`, and the docs were rewritten for a monorepo without web2py. The app version was bumped to **9.0.0** to mark it (e316395d, 3818578d, ced9225e, 9ca14660, 915eef7f, 1bd9ef10, 532e2119, 59055d09, 5db27d55, 674100fa, 7f6486cc).
- **Godot / GDScript activecode (new, WCU CooperLab):** browser-based Godot activecode landed — a GDScript CodeMirror mode moved into acfactory, a unit-test table, cross-iframe messaging with origin filtering, `print` routed to the output pane, disabled-test handling, `TimedGodotActiveCode`, `.zip` handling, and a shared `.wasm` per page (the godot-wasm div moves to whichever activecode was last run), on godot-shell 4.6.3 served from CDN; plus follow-up fixes for error output and `.pck` location (78545a90, d543cb6f, f7eeccd6, c53a022a, a6b4697e, 5c472d36, 217124a7, 07c59683, a43b2c5c, 164d28b8, 79617fff, e3fb64a1, abea7510, 9249535d, 8fd677b1, d17ae19e, 3af65f49, df9b45a7, caf5e81f, 213573b4, 0eafbcc4, 83338bdb).
- **React gradebook is now the gradebook:** switched over from the old one, added filtering and a cell drill-down, made gradebook questions link into grading and grade the whole roster, and switched the display to percentages with a points toggle; fixed inconsistent counts (ea7cb01a, 2c2566cc, ed1857b9, 53494ec3, 64dfc80e).
- **LTI 1.1 grade passback:** grades are pushed to LTI 1.1 courses from every grading path and in real time as students work; the launch course is resolved from `course_lti_map`; the `registration_id` fallback in `fetch_user` was hardened; LTI 1.1 errors are logged and LTI keys were added to the assignment server env (ca0b8c88, 0b86b9dd, e44239b2, 076843f3, 6b18024f, 8adcee1e).
- **LTI 1.3:** LTI availability dates sync to assignments and the RS availability range syncs to the LMS on initial import; added an `instructorTriggered` param to `attempt_lti1p3_score_updates` and set it on instructor-triggered paths; invalid user info now raises; removed out-of-date docs and avoided a class of LTI1p3 errors (938e2a49, 7186d096, 360a019b, b69df74e, c74e0b17, 86bc8b5e, 603d9059).
- **Grading fixes:** manual grading now updates the assignment total, with a new `rsmanage fixtotals` to repair stale totals (and a fix to its student miscount, plus LTI score-push tests); video and poll interactions are scored in assignments and re-graded/displayed in the grader, with quizly added to the interaction-only event list; fixed dragndrop grading when several premises share a dropzone; fixed assignment questions for `ac-single` and the URL used to grade an assignment; stopped hiding assignment questions whose chapter is not in the toc (e33a79b8, 30e073f2, 5121bf9d, 8f977209, 260b8de4, 4e9a8ed6, bc8443c3, f8892e20, faec9990, c9a3075b).
- **Assignment import (new):** assignment import features landed, with warnings when due dates cannot be shifted (99235108, 138f9edc, 6186181f).
- **CodeTailor / personalized Parsons:** fixed personalized Parsons block generation and Java test execution; browsing-mode users can now get the backup Parsons problem (with `get_optional_user` moved into `rsptx.auth.session` for reuse); fixed clipboard copy including distractor blocks and the false "question not found" for book-authored questions (5e8ed081, 15ecfb15, 78fcb01f, 9961e89e, f929289d).
- **Authoring / exercise editor:** `/exercises/edit/<question_id>` works as a real link, the editor no longer clips its own content, added asserts for HTML autograding and an `echoform` endpoint on the assignment server (framable by same-origin pages), made the `text` language support math, fixed codelens parsing in the manifest, and added metadata for the library and create-course flows (e593e217, a910aee7, 8cecfcd7, cd02f59e, 197c70af, 2f69a71a, a36eeb4b, cbfd1411, b0aed4d5).
- **Course management:** an instructor's own courses sort first in the copy-from picker; course names are stripped of leading/trailing whitespace; course deletion no longer fails on missing answer-table cleanup; institutions are matched on tokens instead of whole strings (with more stop words); added a landing-page setting; "no course attrs" is an info, not an error; removed configure-practice; added two rsmanage commands and shell completions (7d44d558, b81018ed, 554c6326, f240ecec, 8864a411, ba9b4f23, 1491e640, 73d4d4b7, cd5c7872, 40a18a26).
- **Static assets / branding:** the real favicon is served for `/runestone/static/favicon.ico`, the logo was added to staticAssets, missing icons were restored with a redirect, webwork js moved to a new location, and the legal page was updated and linked (758961a4, 1f673b7d, d8239ea1, 06d3fce9, de5887f3, 72c55ac8).
- **Build tooling:** `build_books` shows progress as a grid and logs build output to a file, no longer hangs on private repos, and resolves its database URL through settings; fixed missing tab handling; initial dev setup is no longer blocked when the overview can't be built (d4049cbd, d2ce35e8, 674100fa, fa6ed702, 0d9e0d0c).
- **Misc fixes:** activity counts were off by one because of the page itself (with page-progress tests updated to match); `SERVER_PROTOCOL` identifies when to set secure cookies; the assignment builder prefers `scheduled_period` to `scheduled_hidden` when both start and end are set; hardcoded background colors were removed from the shortanswer input; doenet and splice were added to the `QuestionType` enum; fixed the bogus "action was not saved" alert on select-question toggles; flattened traceback `local_vars` serialization; caught non-numeric numbers (e34fcfa4, 258c1247, 5cc28014, db739b17, 383d0578, 0df2fac2, 13f36e95, 08c16070, 1585cfcb).
- **CI / testing:** the interactives vitest suite now runs as part of build test (daccc76c).
- **Releases:** app versions **8.10.8**, **9.0.0**, **9.0.3**, **9.0.4**, **9.0.6**, **9.0.7**, **9.0.8** shipped; bundled runestone JS bumped **8.2.2 → 8.2.6**.

### Commit notes (for reference)

- 78545a90 changes for gdscript browser activcode
- d543cb6f add origin for JavaScriptBridge filtering
- f7eeccd6 added test code to godot payload
- c53a022a added gdscript mode for codemirror
- a6b4697e added table for unit tests
- 5c472d36 fix cross iframe messages
- 217124a7 handle print messages to go to output
- 07c59683 handle Disabled tests
- a43b2c5c godot-shell-4.6.3
- 164d28b8 updated code to work with godot-shell cdn
- 79617fff fixed origin back to runestone.academy after testing
- e3fb64a1 Apply suggestions from code review
- abea7510 used copilot suggestion for change
- 9249535d updated index.pck to support split screen testing
- 8fd677b1 added import for TimedGodotActiveCode
- d17ae19e fixed .visible bug for plain Nodes
- 3af65f49 moved gdscript codemirror to acfactory
- df9b45a7 .zip handling
- caf5e81f shared .wasm per page for efficiency
- e34fcfa4 Fix: activity counts off by 1 due to page.
- e33a79b8 Fix: manual grading did not update the assignment total
- 30e073f2 Add rsmanage fixtotals to repair stale assignment totals
- 40a18a26 make / generate completions for rsmanage
- 603d9059 Avoid LTI1p3 errors
- 5121bf9d Fix fixtotals miscounting students, add LTI score push tests
- c9a3075b Stop hiding assignment questions whose chapter is not in the toc
- d949daf7 Add Barb's fall books
- 81740a9e update runestone to version 8.2.2
- 72c55ac8 Add link to legal page.
- d4049cbd Show build_books progress as a grid, log build output to a file
- 5cc28014 Use SERVER_PROTOCOL to identify when to set secure cookies
- 938e2a49 Sync LTI availability dates to assignments
- db739b17 Assignment builder: prefer scheduled_period to scheduled_hidden when start and end set
- 7186d096 LTI1p3: sync RS availability range to LMS on initial import
- fa6ed702 Fix: missing handling of tabs
- ba9b4f23 Add setting for landing page.
- 683ea2ea New version
- e316395d Route unclaimed URLs to a new admin front door instead of web2py
- 3818578d Replace web2py accessIssue with a sign-in-required page
- ced9225e Remove w2py session info from lti logins
- 0d9e0d0c patch to avoid blocking initial dev setup when overview can't be built
- 5e8ed081 Fix personalized Parsons block generation and Java test execution
- 9ca14660 Take LTI 1.1 launches off the retired web2py destinations
- 3714b204 reorder courses for studyclues
- 915eef7f Stop the build and dev tooling from depending on web2py
- 1bd9ef10 Remove the web2py server
- 532e2119 Update the docs for a monorepo without web2py
- 59055d09 Drop unreferenced legacy assets from staticAssets/js
- 5db27d55 Replace WEB2PY_CONFIG with SERVER_CONFIG
- 674100fa Resolve the build tools' database URL through settings
- 360a019b LTI1p3: add instructorTriggered param to attempt_lti1p3_score_updates
- b69df74e Add instructorTriggered flag to call paths triggered by instructor action
- 86bc8b5e LTI1p3 remove out of date documentation
- c74e0b17 LTI1p3 raise exception for invalid user info
- cbfd1411 New: meta data for library and create course
- b0aed4d5 fix parameter name
- 758961a4 Serve the real favicon for /runestone/static/favicon.ico
- 2c2566cc Add filtering and a cell drill-down to the React gradebook
- 1585cfcb Fix: catch non numeric numbers
- 8be3bac0 update runestone to version 8.2.3
- 7f6486cc update version to 9.0.0
- d2ce35e8 Fix: do not hang on private repos
- 64dfc80e Fix: make counts consistent
- 25b93d83 update runestone to version 8.2.4
- 06d3fce9 New location for webwork js
- 1f673b7d Add logo to staticAssets
- d8239ea1 Restore missing icons and provide redirect
- de5887f3 Update legal page
- 99235108 Implement assignment import features
- 138f9edc Potential fix for pull request finding
- 8f977209 Score video and poll interactions in assignments
- 260b8de4 Re-grade and display video and poll questions in the grader
- ea7cb01a Switch to React gradebook
- 73d4d4b7 remove configure practice
- 554c6326 Fix course deletion failing on missing answer-table cleanup
- ed1857b9 Link gradebook questions to grading, and grade the whole roster
- cd5c7872 Add two commands to rsmanage
- ca0b8c88 Push grades to LTI 1.1 courses from every grading path
- b81018ed eliminate leading/trailing whitespace from course
- 2f69a71a Make sure 'text' language supports math
- 383d0578 Remove hardcoded background colors from shortanswer input
- 076843f3 Harden the LTI registration_id fallback in fetch_user
- 08c16070 Flatten traceback local_vars serialization
- cd02f59e Add an echoform endpoint to the assignment server
- a910aee7 Stop the exercise editor from clipping its own content
- e593e217 Make /exercises/edit/<question_id> work as a real link
- 0df2fac2 Add doenet and splice to QuestionType enum
- 8cecfcd7 New: asserts for html autograding
- 15ecfb15 Allow browsing-mode users to get the backup Parsons problem
- 78fcb01f Move get_optional_user into rsptx.auth.session for reuse
- f240ecec Match institutions on tokens instead of whole strings
- 8864a411 Additional stop words
- a726a6a7 update runestone to version 8.2.5
- 37ceab0f update version to 9.0.3
- 9961e89e Fix CodeTailor clipboard copy including distractor Parsons blocks
- 197c70af Allow /assignment/echoform to be framed by same-origin pages
- faec9990 Fix: update URL to grade an assignment
- 213573b4 bug fixes for error output
- f929289d Fix CodeTailor false "question not found" for book-authored questions
- 6b18024f Add logging for lti1.1 errors
- 25e6b1d7 update version to 9.0.4
- e44239b2 LTI 1.1: resolve the launch course from course_lti_map
- 984ab73e Fix missing user and base_course for _base.html
- 6186181f Add warnings if due dates can't be shifted when importing assignments
- 13f36e95 Fix: bogus "action was not saved" alert on select question toggles
- 258c1247 Update page progress tests to match the counts we want
- daccc76c Run the interactives vitest suite as part of build test
- 53494ec3 Show the gradebook in percentages, with a points toggle
- 1449de87 update lock files
- 97b0b983 update version to 9.0.6
- bc8443c3 Fix dragndrop grading when several premises share a dropzone
- 989d0a57 update version to 9.0.7
- 78ab45c1 run black
- 1d0212eb update version to 9.0.8
- 0eafbcc4 removed the check for external since that might not be where the pck is.
- 83338bdb removed special handling of pck since default way should work
- d15a2304 update runestone to version 8.2.6
- f8892e20 fix assignment Qs for ac-single
- 1491e640 make "no course attrs" an info not an error
- 0b86b9dd Push LTI 1.1 grades in real time as students work
- 7d44d558 Put an instructor's own courses first in the copy-from picker
- a36eeb4b fix parsing of codelens in manifest
- 4e9a8ed6 Add quizly to interaction only events to grade
- 8adcee1e Add LTI keys to assignment server env

## Updates since last changelog entry (2026-07-25 → 2026-08-02)

Coverage: changes landed after the previous changelog update on **2026-07-25**, through **2026-08-02**.

### Highlights

- **Due dates stored in UTC (#1324):** assignment due dates are now stored in UTC; due dates render on the reader's own clock and instructors get a warning when their timezone does not match the course; the migration is blocked on live courses that have no timezone set. Documented `course_datetime_tag`, its required per-page include, and the `RS_info` cookie encoding coupling in `set_tz_offset` (c75e2b6c, 503e0a14, 6d274fcb, 08b957ed, eb3ce2b8).
- **Grading / gradebook:** added a select-all button to the assignment question grader; LTI 1.3 grades are pushed when a manual grade is assigned; gradebook grades are clickable to reveal per-question scores; the new grader shows splice/doenet/iframe answers (#1250); fixed regrade rolling a student's total up to 0; fixed the blank line in the gradebook CSV and dropped jQuery from the exporter (#1115); hparsons blocks are graded by content rather than index (#1194) (dc9a0c00, 6d220b39, 694327ce, 178518b4, 8f92afde, 7ee93f0a, c98fc937).
- **Instructor / course management:** course names on My Courses are clickable and the list has a course filter; text fields are validated on registration and course creation (#1305, #1306, #608, #609); CSV fields are trimmed on student enrollment (#343); assignment visibility dates are adjusted when a course is copied (#1165); new books get a default `shelf_section` and course creation no longer errors on books with `shelf_section = None`; Chapter Activity now shows enrolled students with no activity (#1133); added a `course_attr_is_true` helper (fd2f752b, 149683d3, a68e9c82, 6ac0fd29, f179fc93, 7ddba1e0, ab69df4a, caf1a7f6).
- **web2py migration (continued):** ported the editorial page (`manage_exercises`) to the admin server; removed the book server's unused `/ns/auth` login endpoints (58dd4c1f, e5a09514).
- **Interactives:** clickable-area questions are now keyboard and screen-reader accessible; activecode asks for `input()` inline instead of through `window.prompt` and writes output synchronously (#475), with button coloring for the new input widget; fixed the activecode statement showing twice in toggle questions (#1328); improved the matching component's look and feel, drag-from-right anchoring, keyboard tab flow, and dashed selected line; Peer Instruction UI improvements plus showing correctness after the second async vote; added test courses for studyclues; updated node dependencies (f7f0c40e, cb63ef29, b073574b, a34b0571, 8ef7f981, 0c11b8c0, ae2d7917, f3ac23d4, 9b3ae184, 259150a4, 6998bd9d, 587257ea, c4829010).
- **Reading progress / book server:** every activity on a page is counted when browsing logged out (#990); fixed the page progress bar on index pages and its activity counts (#613, #614); the reading score is sent on the required activity rather than one early; student pages use the PTX-generated base template by default (8896df3b, 19711e28, 505c8474, 7516bf10).
- **Auth / routing / config:** the auth cookie is scoped to `LOAD_BALANCER_HOST` so subdomains share it (#606); the author server URL is configurable (#886); fixed bare admin routing in the Caddyfile (90dae201, 944ef719, ca8abd8c).
- **Book build tooling:** `build_books` gained a `--ptx-only` switch, handles repos with upstream remotes, creates the destination folder when missing, and has logging fixes; the source repository shows in book metadata with repo info moved below the editable fields; the manifest processor strips `document-id` even when the closing tag is on the next line; fixed the message when running `--core`; updated PreTeXt (037cd022, eef2f2df, 35b651cc, d33b0a5c, d1aca4fc, 2109791c, d660dca2, 9b1d2855, 349cc832, 93162f41).
- **Assignment builder:** the LaTeX macro preamble no longer leaks into the preview (#1248, #842); fixed 36 failing assignment builder tests and put the suite in CI (8207f309, ee4df46b).
- **Dev experience / CI / docs:** the dev server no longer polls the filesystem (#371); tightened the Node version requirement for the JS packages; pinned ruff to 0.15.x; skipped pycairo in the CRUD test workflow; the jobe image waits for apache to fully start; fixed five install-guide problems reported by new contributors (e05702ad, 054ed896, b86a7590, fd9d073c, 53d29b3d, 3ed291d6).
- **Releases:** app versions **8.10.7** and **8.10.8** shipped; bundled runestone JS bumped to **8.2.0** and **8.2.1**.

### Commit notes (for reference)

- c75e2b6c Store assignment due dates in UTC
- 503e0a14 Show due dates on the reader's clock, warn instructors on a timezone mismatch
- 6d274fcb Block the duedate migration on live courses with no timezone
- 08b957ed Document course_datetime_tag and its required per-page include
- eb3ce2b8 Document RS_info cookie encoding coupling in set_tz_offset
- dc9a0c00 Add select all button to assignment question grader
- 6d220b39 Update lti1p3 grades when manual grade is assigned
- 694327ce Make gradebook grades clickable to show per-question scores
- 178518b4 issue-1250 show splice/doenet/iframe answers in the new grader
- 8f92afde Fix regrade rolling a student's total up to 0
- 7ee93f0a issue-1115 fix blank line in gradebook CSV, drop jQuery from the exporter
- c98fc937 Fix #1194: grade hparsons blocks by content, not by index
- fd2f752b Make course names clickable and add a course filter on My Courses
- 149683d3 Fix #1305, #1306, #608, #609: validate text fields on registration and course creation
- a68e9c82 Fix #343: trim whitespace from CSV fields on student enrollment
- 6ac0fd29 Adjust assignment visibility dates on copy (#1165)
- f179fc93 New books get default shelf_section if not provided
- 7ddba1e0 Fix: course creation - prevent comparison error for books with None shelf_section
- caf1a7f6 Add course_attr_is_true helper
- ab69df4a issue-1133 show enrolled students with no activity in Chapter Activity
- 58dd4c1f Port the editorial page (manage_exercises) to the admin server
- e5a09514 Remove the book server's unused /ns/auth login endpoints
- f7f0c40e Make clickable area questions keyboard and screen reader accessible
- cb63ef29 Ask for input() inline instead of through window.prompt (#475)
- b073574b Fix #475: write activecode output synchronously
- a34b0571 Button coloring for new input widget
- 8ef7f981 Fix #1328: activecode statement shown twice in toggle questions
- 0c11b8c0 Improve matching component look and feel
- ae2d7917 Address PR feedback: drag-from-right anchoring and keyboard tab flow
- f3ac23d4 Make selected line dashed
- 9b3ae184 improvements to PI UI
- 259150a4 Show correctness after the second async vote
- 6998bd9d Add test courses for studyclues
- 587257ea update node deps
- c4829010 update node dependencies
- 8896df3b issue-990 count every activity on a page when browsing logged out
- 19711e28 Fix page progress bar on index pages and its activity counts (#613, #614)
- 505c8474 Send the reading score on the required activity, not one early
- 7516bf10 Student pages use ptx generated base template by default
- 90dae201 Scope the auth cookie to LOAD_BALANCER_HOST so subdomains share it (#606)
- 944ef719 Make the author server URL configurable (#886)
- ca8abd8c Fix for bare admin routing
- 037cd022 Add --ptx-only switch to build_books
- eef2f2df Handle repos with upstream remotes
- 35b651cc Fix: Create destination folder if it does not exist.
- d33b0a5c Fix logging for build_books
- d1aca4fc Fix logging in process manifest
- 2109791c fix: show source repository in book metadata
- d660dca2 Move repo info below the editable fields
- 9b1d2855 strip document-id in case closing tag is on next line
- 349cc832 fix message when running --core
- 93162f41 update ptx
- 8207f309 Fix #1248, #842: latex macro preamble leaks into assignment builder preview
- ee4df46b Fix 36 failing assignment builder tests and put the suite in CI
- e05702ad Fix #371: stop the dev server polling the filesystem
- 054ed896 Tighten the Node version requirement for the JS packages
- b86a7590 pin ruff version to 0.15.x
- fd9d073c Skip pycairo in the CRUD test workflow
- 53d29b3d Make sure apache is fully started
- 3ed291d6 Docs: fix five install-guide problems reported by new contributors
- 32125f37 Update logger message
- 354bab4d update version to 8.10.7
- c789049e update version to 8.10.8
- 5bfe4c48 update runestone to version 8.2.0
- d93caee4 update runestone to version 8.2.1

## Updates since last changelog entry (2026-07-07 → 2026-07-24)

Coverage: changes landed after the previous changelog update on **2026-07-07**, through **2026-07-24**.

### Highlights

- **web2py migration (continued):** ported student autograde from web2py to the assignment server; migrated the legal/compliance pages to the admin server behind a new Trust Center hub; migrated and modernized the Getting Started page; unauthenticated page requests now redirect to the login page, and the donate page no longer requires login (e5b95221, 68f92fca, a6c89a65, 5555b455, 23266b25, a316b6a6).
- **Library book build tooling (new `build_books`):** added a `build_books` script to build and deploy all library books, with pre/post build hooks, most-used-books-first ordering, parallel builds with per-book failure alerts and `--exclude`, a `--gen` flag to force PreTeXt asset generation, and handling for `.overrides` files present on dev; hardened file ownership (reclaim root-owned book files, restore `work_dir` ownership after author builds, tolerate marker-touch failures); added prefigure to the CLI (d6c4150b, b8a43bfa, 52fc4d29, 7050668f, e13b1de4, 01cb8e3b, a8aab1e5, baa0e13a, 5f3798e7, fa337d78).
- **rsadmin CLI (new):** added an `rsadmin` pip project for host-side build/manage/migrate operations; sped up rsmanage startup (a90825a5, 6200a518).
- **Problem-report feature (new):** added a "report a problem" page and menu, a GitHub link, browser-console-log capture in reports, and a prompt for more information (df7bae99, d8d6a5c7, bdbca035, 2667490e, f712d756).
- **Security / auth:** reject a spoofed `sid` in `log_book_event` unless it's the same course; fixed book-server bugs around peer-chat publish, question HTML, `gethist`, and `changeCourse` authz; fixed the matching component leaking answers across users via localStorage; validate usernames on creation; log key auth events and make auth log messages more consistent (b76121ca, 104132c1, f2ee56d7, 367c1bc3, 7e7bb6a5, 7a5685b2).
- **Parsons / grading:** fixed greedy selection in the Parsons line-grader LIS calculation and copied the improved LIS into the hparsons block grader (with a vitest suite); fixed gradebook totals not updating on regrade (esp. timed exams, #1309/#1310) with covering tests; improved the example-solution prompt for Parsons puzzles (e40c67cf, a7ad8298, 69dc0e98, 8d198944, 3538e954, 4f54aab7).
- **Interactives fixes:** dragndrop gained keyboard controls, target highlighting while dragging a premise, and a fix so selecting a placed premise doesn't reset its location; fixed MCQ multiple-answer checking with 10+ answers and MCQ losing its first-choice answer on reload (#1319); disallow randomization on a PI page; use an explicit radix; cleaned up interactives dependencies/imports and added canvas (1add9120, 294734c4, 93946fc8, 2f9688de, 62a035b5, 09860be0, 866fcdc4, dba03e7e, 022a3e57).
- **FITB:** import of local libraries is now relative to the document instead of the RS library; answer must be a string (85ea2fff, 0b40ce3f).
- **PreTeXt:** use PTX-generated chapter numbers when processing the manifest; fixed missing styles on the `doAssignment` page (4b0b6d62, a2de53ac).
- **Peer Instruction:** PI fixes from live demos plus copilot/LLM prompting fixes (9513232a, f87ebe27).
- **LTI 1.1:** added an LTI 1.1 link section to assignments; removed the `with_course` decorator from course creation (383900a5, c8d0a0a7).
- **Infra / fixes:** fixed migration running and merged migration heads; deduped the context dict / possible dupes; misc doc fixes (homebrew link, fork message, window-paths reminder, contribution-doc typo) (0af8416c, 0a4d08df, f61aeed7, fbaa68ab, c280b838, 8aa537c9, cab6e7ef, b96683c4, 6bbf2dac).
- **Releases:** app versions **8.10.0 → 8.10.5** shipped; bundled runestone JS bumped through **8.1.10 → 8.1.15**.

### Commit notes (for reference)

- e5b95221 Port student autograde from web2py to assignment server
- 68f92fca Migrate legal/compliance pages to admin server with Trust Center hub
- a6c89a65 Update legal hub
- 5555b455 Migrate Getting Started page to admin server and modernize it
- 23266b25 Redirect unauthenticated page requests to the login page
- a316b6a6 Do not require login for donate
- d6c4150b add build_books script to build and deploy all library books
- b8a43bfa Add pre/post build hooks to library books
- 52fc4d29 Build most-used books first
- 7050668f Build books in parallel, with per-book failure alerts and --exclude
- e13b1de4 Add --gen flag to build_books to force PreTeXt asset generation
- 01cb8e3b In .overrides if the file is present on dev
- a8aab1e5 Reclaim root-owned book files and tolerate marker-touch failures
- baa0e13a Restore work_dir ownership after author book builds
- 5f3798e7 Add prefigure to cli
- fa337d78 ignore override
- a90825a5 Add rsadmin pip project: host-side build/manage/migrate CLI
- 6200a518 rsmanage startup speedups
- df7bae99 Make a problem report page
- d8d6a5c7 add menu for report a problem
- bdbca035 add link to github
- 2667490e Include browser console log in problem reports
- f712d756 Try to prompt for more information
- b76121ca Reject spoofed sid in log_book_event unless same course
- 104132c1 Fix book server bugs: peer chat publish, question html, gethist, changeCourse authz
- f2ee56d7 Fix matching component leaking answers across users via localStorage
- 367c1bc3 Fix: usernames were not validated
- 7e7bb6a5 Log key auth events
- 7a5685b2 make auth log messages more consistent
- e40c67cf Fix: avoid greedy selection in parsons line grader LIS calculation
- a7ad8298 Fix: copy improved LIS to hparsons blockgrader
- 69dc0e98 Add vitest for linegrader LIS algorithm
- 8d198944 Fix gradebook totals not updating on regrade (esp. timed exams)
- 3538e954 Add regrade_batch tests covering the #1309 total-recompute fix
- 4f54aab7 Improve example solution prompt for Parsons puzzles
- 1add9120 Add keyboard controls for dragndrop
- 294734c4 Dragndrop: highlight targets while dragging premise
- 93946fc8 Fix: selecting dragndrop premise does not reset location if already placed
- 2f9688de Fix: checking for multiple choice multiple answer with 10+ answers
- 62a035b5 Fix MCQ losing first-choice answer on reload (issue #1319)
- 09860be0 Do not allow randomization when on a PI page
- 866fcdc4 Use explicit radix
- dba03e7e Clean up dependencies and imports
- 022a3e57 Interactives: remove - from dependencies; add canvas
- 85ea2fff FITB: Import of local libraries need to be relative to document not RS library
- 0b40ce3f Fix: answer needs to be a string
- 4b0b6d62 Use PTX generated chapter numbers when processing manifest
- a2de53ac Fix: missing styles on doAssignment page
- 9513232a pi fixes from live demos
- f87ebe27 copilot and llm prompting fixes
- 383900a5 Add LTI 1.1 link section to assignment
- c8d0a0a7 Fix: remove with_course decorator from course creation
- 0af8416c Fix: fix migration running
- 0a4d08df merge migration heads
- f61aeed7 fix: possible dupes in context dict
- fbaa68ab issue 1270
- c280b838 Issue 1273
- 8aa537c9 Added clickable homebrew link
- cab6e7ef Adds fork message to developer setup
- b96683c4 Adds an reminder to aviod window paths
- 6bbf2dac Fix grammar typo in contribution docs

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
