// Characterization tests for presenter mode (instructor-only "Code
// Presenter" view on Sphinx book pages). Written first against the jQuery
// implementation; the exercise-navigation assertions encode the intended
// behavior, which the jQuery version never delivered (getActiveExercise
// assigned an undeclared variable, a ReferenceError under ESM strict mode).
//
// Presenter mode keeps module-level state (setup runs once per page), so
// these tests run as one sequential flow against a single page.
// Note: deliberately NO jquery-globals import here -- presenter mode must
// work without jQuery.
import { it, expect, beforeAll } from "vitest";
import "../js/presenter_mode.js";

function setMode(value) {
    const select = document.querySelector(".mode-select");
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeAll(() => {
    document.body.innerHTML = `
      <nav><ul class="nav navbar-nav navbar-right"></ul></nav>
      <section>
        <h1>The Chapter</h1>
        <p id="prose">Expository text.</p>
        <div class="runestone" id="ex1"><div class="ac_code_div"></div></div>
        <div class="runestone" id="ex2"><div class="ac_code_div"></div></div>
      </section>`;
    localStorage.clear();
    eBookConfig.isInstructor = true;
    document.dispatchEvent(new CustomEvent("runestone:login-complete"));
    eBookConfig.isInstructor = false;
});

it("adds the View dropdown to the navbar for instructors", () => {
    const select = document.querySelector(".navbar-right .mode-select");
    expect(select).not.toBe(null);
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(["text", "present"]);
});

it("entering presenter mode hides prose but keeps headings and exercises", () => {
    setMode("present");
    expect(document.body.classList.contains("present")).toBe(true);
    expect(document.body.classList.contains("full-height")).toBe(true);
    expect(
        document.getElementById("prose").classList.contains("hidden"),
    ).toBe(true);
    expect(document.querySelector("h1").classList.contains("hidden")).toBe(
        false,
    );
    expect(document.getElementById("ex1").classList.contains("hidden")).toBe(
        false,
    );
    expect(localStorage.getItem("presentMode")).toBe("present");
});

it("adds Back/Next presenter buttons before the heading", () => {
    const title = document.querySelector(".presentation-title");
    expect(title).not.toBe(null);
    expect(title.nextElementSibling.tagName).toBe("H1");
    expect(title.querySelector(".prev-exercise")).not.toBe(null);
    expect(title.querySelector(".next-exercise")).not.toBe(null);
});

it("shows one exercise at a time and navigates with next/prev", () => {
    const ex1 = document.getElementById("ex1");
    const ex2 = document.getElementById("ex2");
    expect(ex1.classList.contains("active")).toBe(true);
    expect(ex2.classList.contains("hidden")).toBe(true);
    window.nextExercise();
    expect(ex2.classList.contains("active")).toBe(true);
    expect(ex1.classList.contains("hidden")).toBe(true);
    window.nextExercise(); // already at the end; stays put
    expect(ex2.classList.contains("active")).toBe(true);
    window.prevExercise();
    expect(ex1.classList.contains("active")).toBe(true);
});

it("leaving presenter mode restores the hidden prose and body state", () => {
    setMode("text");
    expect(document.body.classList.contains("present")).toBe(false);
    expect(
        document.getElementById("prose").classList.contains("hidden"),
    ).toBe(false);
    expect(localStorage.getItem("presentMode")).toBe("text");
});
