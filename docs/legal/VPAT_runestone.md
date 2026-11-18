# Voluntary Product Accessibility Template (VPAT®)
## WCAG 2.1 Level AA – Accessibility Conformance Report

### Product Name
Runestone Academy Website

### Vendor Name
Runestone Academy

### Report Date
August 2026 (supersedes the January 2026 report)

### Conformance Target
Web Content Accessibility Guidelines (WCAG) 2.1 – Level AA

---

## 1. Scope of Evaluation

This VPAT-style report covers a representative sample of pages across the Runestone
Academy platform, including both unauthenticated and authenticated workflows:

**Public / authentication**

- https://runestone.academy
- Log in, register, forgot password, forgot username, reset password

**Student workflows (authenticated)**

- Course chooser, my courses, user profile, donation page
- Assignment chooser, assignment view, progress report
- Peer instruction pages

**Instructor and administrative workflows (authenticated)**

- Instructor dashboard, course settings, manage students, manage instructors
- Create course, copy assignments, assessment reset, course delete, LTI configuration
- Chapter and assignment summary reports, student drill-down reports

**Interactive textbook content**

- Published PreTeXt book pages exercising the interactive components (ActiveCode,
  Parsons problems, multiple choice, fill in the blank, clickable area, matching,
  short answer, polls, CodeLens, timed exams, video)

Pages were evaluated in **both the light and dark display themes**, since the platform
offers a dark mode and the two themes use different color palettes.

---

## 2. Evaluation Methodology

The evaluation was performed using:

- Manual inspection of rendered HTML and visible page structure
- Review of headings, landmarks, form labels, and navigation
- Keyboard-only navigation checks for primary workflows
- The **WAVE Accessibility Evaluation Tool** browser extension, on both public and
  authenticated pages, with results reviewed manually to separate genuine issues from
  false positives
- **Programmatic contrast measurement.** Rather than judging contrast by eye, each page
  was loaded in a real browser and every rendered text node was measured against the
  actual painted background behind it, computing the WCAG contrast ratio from the
  browser's own computed styles. The measurement resolves CSS gradients (evaluating the
  weakest color stop) and modern color spaces such as `oklab()`, and was run in both the
  light and dark themes, and again after submitting answers so that graded and error
  states were measured rather than only the initial page.

This assessment **did not include**:

- Formal screen reader testing (JAWS, NVDA, VoiceOver)
- Task-based testing with users with disabilities
- Exhaustive coverage of every interactive component and user path

As such, this report represents a **best-effort conformance assessment**, not a formal
certification.

---

## 3. Conformance Levels

- **Supports**: The criterion is met with no known issues.
- **Partially Supports**: Some aspects meet the criterion; others may require improvement or verification.
- **Does Not Support**: The criterion is not met.
- **Not Applicable**: The criterion does not apply to this product.

---

## 4. WCAG 2.1 Conformance Table

| WCAG Criterion | Conformance | Remarks |
|---------------|------------|---------|
| **1.1.1 Non-text Content** | Partially Supports | Images and icons include visible text alternatives where applicable. Some dynamically rendered interactive content (e.g., exercises, math) may require additional ARIA labeling or verification with assistive technologies. |
| **1.3.1 Info and Relationships** | Partially Supports | Pages use headings, lists, and semantic HTML. Report tables use `<th>` elements for row and column headers, and a `<main>` landmark wraps the primary content region of application pages. Consistency of heading hierarchy within interactive book pages should still be verified with assistive technologies. |
| **1.3.2 Meaningful Sequence** | Supports | Reading order appears logical in linearized views. |
| **1.4.1 Use of Color** | Partially Supports | Color is generally accompanied by text. Two known exceptions remain: overdue assignment due dates and the per-question score cells in the assignment summary report are distinguished primarily by color. Both are readable at AA contrast, but a non-color cue has not yet been added. |
| **1.4.3 Contrast (Minimum)** | Partially Supports | A full contrast remediation was completed in August 2026 and verified by measurement (see §2). All text on the authentication, student, instructor and administrative pages listed in §1 meets the 4.5:1 minimum in both light and dark themes, as does text in the interactive textbook components, including graded and error states. Colors are now defined as a documented palette with the measured ratio recorded alongside each value. Residual issues are confined to chrome supplied by the PreTeXt book template rather than by Runestone: a byline (4.44:1) and two code-syntax token colors (4.32:1 and 3.73:1) fall marginally short on published book pages. |
| **1.4.5 Images of Text** | Supports | Text content is rendered as text rather than images, except where mathematical notation is rendered programmatically. |
| **1.4.11 Non-text Contrast** | Partially Supports | Form input and select borders, which are the only cue identifying those controls, were raised to meet the 3:1 minimum, and the focus indicator described under 2.4.7 exceeds it. Purely decorative rules and separators are exempt. Icons, charts and other graphical objects have not yet been individually assessed against this criterion. |
| **2.1.1 Keyboard** | Partially Supports | Core navigation and forms are keyboard accessible. Interactive textbook components require further keyboard-only testing. |
| **2.1.2 No Keyboard Trap** | Supports | No keyboard traps observed in primary navigation and forms. |
| **2.4.1 Bypass Blocks** | Partially Supports | A `<main>` landmark wraps the primary content region of application pages, and the book template provides a "Skip to main content" link. That skip link currently has no visible focus indicator of its own, so it is difficult to perceive when reached by keyboard. |
| **2.4.2 Page Titled** | Supports | Pages have descriptive and unique titles. |
| **2.4.6 Headings and Labels** | Supports | Headings and labels are generally descriptive and informative. |
| **2.4.7 Focus Visible** | Partially Supports | A single high-contrast focus indicator (8.79:1 against the page background, drawn clear of the control so its contrast does not depend on what it surrounds) is applied across the Runestone application interface; it was verified on 236 of 237 focusable controls on the pages listed in §1. Published book pages are rendered by the PreTeXt template, which does not load that stylesheet: there, the skip link noted under 2.4.1 and some embedded third-party editors and math widgets still rely on their own focus handling and have not been verified. |
| **3.1.1 Language of Page** | Supports | Page language is programmatically declared. |
| **3.3.2 Labels or Instructions** | Supports | Form fields include visible labels and instructions. Course selection and profile forms additionally expose descriptive ARIA labels and help text associations. |
| **4.1.1 Parsing** | Supports | Markup appears well-formed in tested pages. |
| **4.1.2 Name, Role, Value** | Partially Supports | Standard UI elements expose appropriate accessibility semantics, and ARIA labels and descriptions were added to the course selection and profile controls. Custom interactive elements may still require additional ARIA roles and states, and this has not been confirmed with a screen reader. |

---

## 5. Known Strengths

- Clear page titles and navigation structure
- Labeled form fields on login and user workflows
- Semantic HTML used for core layout and navigation, including a `<main>` landmark
- Consistent navigation across pages
- A documented color palette in which every value records its measured contrast ratio,
  so future changes can be checked against the same standard
- A single, consistent, high-contrast keyboard focus indicator across the application
- Contrast verified by measurement in both light and dark themes, including graded and
  error states

---

## 6. Known Limitations and Areas for Improvement

- **Screen reader verification**: No formal testing with JAWS, NVDA or VoiceOver has been
  performed. This is the most significant remaining gap in this assessment.
- **Interactive Content**: Coding exercises, quizzes, and mathematical content rendered
  via JavaScript should be verified with screen readers and keyboard-only navigation.
- **ARIA Enhancements**: Some custom widgets may benefit from additional ARIA roles,
  states, or descriptions.
- **Book template chrome**: A small number of contrast and focus issues on published book
  pages originate in the PreTeXt page template and third-party editor and math widgets
  rather than in Runestone's own code. These are tracked and raised upstream where
  appropriate.
- **Non-color cues**: The two color-only status indicators noted under 1.4.1 should be
  given a text or icon cue.

---

## 7. Assumptions and Disclaimers

This VPAT is based on manual review and automated measurement of a representative sample
of pages, and does not constitute a legal guarantee of accessibility compliance.
Accessibility is an ongoing process, and Runestone Academy continues to improve support
for users with disabilities.

---

## 8. Contact Information

For accessibility questions, feedback, or accommodation requests, please contact:

Runestone Academy
https://runestone.academy


# Accessibility Testing Statement

## Product
Runestone Academy Website and Interactive Textbook Platform

## Accessibility Standard
Web Content Accessibility Guidelines (WCAG) 2.1 Level AA

---

## Overview

Runestone Academy is committed to providing an accessible learning platform for students
and instructors, including users with disabilities. Accessibility is addressed as an
ongoing process that includes design, development, testing, and remediation activities.

This statement describes the accessibility testing methods used to evaluate and improve
conformance with WCAG 2.1 Level AA.

---

## Testing Methods

Accessibility testing is performed using a combination of **manual review, automated
tooling, and functional testing**, including the following methods:

### 1. Manual Structural Review
- Inspection of page structure, headings, landmarks, and semantic HTML
- Verification of form labels, instructions, and error messaging
- Review of navigation consistency and page titles

### 2. Keyboard Navigation Testing
- Manual keyboard-only testing of core workflows
- Verification that navigation, forms, and interactive controls are operable without a mouse
- Checks for keyboard traps and logical focus order
- Automated enumeration of focusable controls on a page to confirm each one presents a
  visible focus indicator

### 3. Automated and Assisted Tooling
- Use of the **WAVE Accessibility Evaluation Tool** browser extension to identify:
  - Missing or improper form labels
  - Contrast issues
  - Missing alternative text
  - ARIA usage and structural alerts
- Tool results are reviewed manually to distinguish actionable issues from false positives.

### 4. Programmatic Contrast Measurement
Contrast is measured rather than estimated. Pages are loaded in a real browser and every
rendered text node is compared against the background actually painted behind it, using
the browser's own computed styles to derive the WCAG contrast ratio. The measurement:

- resolves CSS gradients by evaluating the weakest color stop, so a control with a
  gradient background is judged at its least readable point;
- resolves modern color spaces such as `oklab()` through the browser rather than by
  parsing text, which avoids both false alarms and missed failures;
- is run in both the light and dark display themes; and
- is repeated after answers are submitted, so that graded, correct and error states are
  measured rather than only the initial page.

### 5. Authenticated Page Evaluation
Pages requiring authentication are evaluated after logging in as a standard user and,
separately, as an instructor. This allows assessment of:
- User dashboards and account management
- Interactive exercises and activities
- Assignment, peer instruction, and progress reporting workflows
- Instructor and administrative interfaces

---

## Scope of Testing

Accessibility testing is performed on a representative set of pages and interactions,
including:
- Public landing pages
- Authentication and account management pages
- Interactive textbook content in both light and dark themes
- Exercise, assessment, peer instruction, and group-work components
- Instructor and administrative interfaces

Due to the dynamic nature of interactive educational content, not all possible user paths
are evaluated during each review cycle.

---

## Known Limitations

Some interactive components are rendered dynamically using JavaScript. While these
components are designed to follow accessibility best practices, full verification with
assistive technologies such as screen readers may require additional task-based testing,
and no formal screen reader testing has been performed to date.

Published textbook pages combine Runestone's interactive components with the PreTeXt page
template and third-party code editor and mathematics widgets. Issues originating outside
Runestone's own code are raised upstream where appropriate.

Accessibility issues identified through testing are prioritized and addressed as part of
ongoing development and maintenance.

---

## Continuous Improvement

Runestone Academy regularly reviews accessibility feedback and incorporates improvements
into the platform. Accessibility testing is repeated as features evolve, and this
statement is updated as testing practices mature.

---

## Contact Information

For accessibility questions, feedback, or accommodation requests, please contact:

Runestone Academy
https://runestone.academy
