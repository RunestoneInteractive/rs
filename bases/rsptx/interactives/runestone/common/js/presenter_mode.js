// Instructor-only "Code Presenter" view for Sphinx book pages: hides the
// prose and steps through the interactive exercises one at a time.

var codeExercises = []; // Array of top-level .runestone exercise divs
var presentModeInitialized = false;

// Elements a presenter wants to keep on screen.
const KEEP_VISIBLE =
    "h1, .presentation-title, .btn-presenter, .runestone, .runestone *, section, .pre, code";

function sectionContent() {
    return [...document.querySelectorAll("section *")].filter(
        (el) => !el.matches(KEEP_VISIBLE),
    );
}

function presentToggle() {
    if (!presentModeInitialized) {
        presentModeSetup();
        presentModeInitialized = true;
    }
    let bod = document.body;
    let presentClass = "present";
    let fullHeightClass = "full-height";
    let bottomClass = "bottom";
    if (bod.classList.contains(presentClass)) {
        for (const el of sectionContent()) {
            el.classList.remove("hidden"); //show everything
        }
        document
            .getElementById("completionButton")
            ?.classList.remove("hidden");
        bod.classList.remove(presentClass);
        for (const el of document.querySelectorAll("." + fullHeightClass)) {
            el.classList.remove(fullHeightClass);
        }
        for (const el of document.querySelectorAll("." + bottomClass)) {
            el.classList.remove(bottomClass);
        }
        localStorage.setItem("presentMode", "text");
        for (const exercise of codeExercises) {
            exercise.classList.remove("hidden");
        }
    } else {
        for (const el of sectionContent()) {
            el.classList.add("hidden"); // hide extraneous stuff
        }
        document.getElementById("completionButton")?.classList.add("hidden");
        bod.classList.add(presentClass);
        bod.classList.add(fullHeightClass);
        document.documentElement.classList.add(fullHeightClass);
        for (const el of document.querySelectorAll("section .runestone")) {
            el.classList.add(fullHeightClass);
        }
        for (const el of document.querySelectorAll(".ac-caption")) {
            el.classList.add(bottomClass);
        }
        localStorage.setItem("presentMode", presentClass);
        activateExercise();
    }
}

function presentModeSetup() {
    // moved this out of configure

    // this still leaves some things semi-messed up when you exit presenter mode.
    // but instructors will probably just learn to refresh the page.
    for (const component of document.querySelectorAll(
        "[data-childcomponent]",
    )) {
        component.classList.add("runestone");
        const parentDiv = component.parentElement?.closest("div");
        if (parentDiv && !parentDiv.matches("section")) {
            parentDiv.classList.add("runestone");
            parentDiv.style.maxWidth = "none";
        }
        const parts = component.querySelectorAll(".ac_code_div, .ac_output");
        if (parts.length) {
            const block = document.createElement("div");
            block.className = "ac-block";
            block.style.width = "100%";
            parts[0].before(block);
            for (const part of parts) {
                block.appendChild(part);
            }
        }
    }

    for (const img of document.querySelectorAll("section img")) {
        const wrapper = document.createElement("div");
        wrapper.className = "runestone";
        img.replaceWith(wrapper);
        wrapper.appendChild(img);
    }
    // top-level exercises only: skip .runestone nested inside another
    codeExercises = [...document.querySelectorAll(".runestone")].filter(
        (el) => !el.parentElement.closest(".runestone"),
    );
    for (const heading of document.querySelectorAll("h1")) {
        heading.insertAdjacentHTML(
            "beforebegin",
            "<div class='presentation-title'> \
        <button class='prev-exercise btn-presenter btn-grey-outline' onclick='prevExercise()'>Back</button> \
        <button class='next-exercise btn-presenter btn-grey-solid' onclick='nextExercise()'>Next</button> \
      </div>",
        );
    }
}

function getActiveExercise() {
    return codeExercises.filter((el) => el.classList.contains("active"));
}

function activateExercise(index) {
    if (typeof index == "undefined") {
        index = 0;
    }

    if (codeExercises.length) {
        for (const el of getActiveExercise()) {
            el.classList.remove("active");
        }
        const active = codeExercises[index];
        active.classList.add("active");
        active.classList.remove("hidden");
        for (const el of codeExercises) {
            if (el !== active) {
                el.classList.add("hidden");
            }
        }
    }
}

window.nextExercise = function () {
    let active = getActiveExercise()[0];
    let nextIndex = codeExercises.indexOf(active) + 1;
    if (nextIndex < codeExercises.length) {
        activateExercise(nextIndex);
    }
};

window.prevExercise = function () {
    let active = getActiveExercise()[0];
    let prevIndex = codeExercises.indexOf(active) - 1;
    if (prevIndex >= 0) {
        activateExercise(prevIndex);
    }
};

function configure() {
    let rightNav = document.querySelector(".navbar-right");
    if (!rightNav) {
        return;
    }
    rightNav.insertAdjacentHTML(
        "afterbegin",
        "<li class='dropdown view-toggle'> \
      <label>View: \
        <select class='mode-select'> \
          <option value='text'>Textbook</option> \
          <option value='present'>Code Presenter</option> \
        </select> \
      </label> \
    </li>",
    );

    document
        .querySelector(".mode-select")
        .addEventListener("change", presentToggle);
}

document.addEventListener("runestone:login-complete", function () {
    // if user is instructor, enable presenter mode
    if (eBookConfig.isInstructor) {
        configure();
    }
});
