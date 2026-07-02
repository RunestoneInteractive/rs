/* Create course (admin/instructor/create_course.html) */

// Populate timezone select with supported timezones and default to browser's timezone
document.addEventListener("DOMContentLoaded", function () {
    var tzSelect = document.getElementById("timezone");
    if (tzSelect && typeof Intl.supportedValuesOf === "function") {
        var timezones = Intl.supportedValuesOf("timeZone");
        var browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        timezones.forEach(function (tz) {
            var opt = document.createElement("option");
            opt.value = tz;
            opt.textContent = tz;
            if (tz === browserTz) {
                opt.selected = true;
            }
            tzSelect.appendChild(opt);
        });
    }
});

// Minimal domain name validation
document.getElementById("domainname").addEventListener("change", function () {
    const domain = this.value;
    if (domain.indexOf(".") === -1 || domain.indexOf(" ") !== -1) {
        this.setCustomValidity(
            'Domain name must contain at least one "." and no spaces.'
        );
    } else {
        this.setCustomValidity("");
    }
});

document.getElementById("invoice-me").addEventListener("change", function () {
    if (this.checked) {
        let res = confirm(
            "Checking this box means you want us to email you an Invoice (Thank you!!).  If you want to keep using Runestone for free just click cancel"
        );
        if (res === false) {
            this.checked = false;
        }
    }
});

function suggestedCourseName() {
    let d = new Date();
    const getSeason = (d) => Math.floor(((d.getMonth() + 1) / 12) * 4) % 4;
    let season = ["winter", "spring", "summer", "fall"][getSeason(d)];
    let basecourse = document.getElementById("designerForm").coursetype.value;
    let instid = document.getElementById("institution").value;
    let suggestedCourse = "";
    if (instid) {
        suggestedCourse += instid.toLowerCase().replace(/ /g, "");
    }
    if (basecourse) {
        suggestedCourse += "_" + basecourse.toLowerCase();
    }
    suggestedCourse += "_" + season + (d.getFullYear() % 100);
    document.getElementById("projectname").value = suggestedCourse;
}

document
    .getElementById("designerForm")
    .addEventListener("submit", function (evt) {
        const errors = [];
        const institution = document.getElementById("institution").value;
        const basecourse = document.getElementById("designerForm").coursetype.value;
        const level = document.getElementById("courselevel").value;
        const domain = document.getElementById("domainname").value;
        const projectname = document.getElementById("projectname").value;
        const errorDiv = document.getElementById("formerrors");
        errorDiv.innerHTML = "";
        errorDiv.style.display = "none";
        if (!basecourse) {
            errors.push("You must select a book for your course.");
        }
        if (!institution) {
            errors.push("You must provide the name of your Institution.");
        }
        if (level === "unknown") {
            errors.push("Please tell us approximately what level your course is at.");
        }
        if (
            projectname === "" ||
            projectname.indexOf(" ") !== -1 ||
            projectname.indexOf("/") > -1
        ) {
            errors.push("Your Project Name may not contain spaces or /");
        }
        if (!/^([\x30-\x39]|[\x41-\x5A]|[\x61-\x7A]|[_-])*$/.test(projectname)) {
            errors.push(
                "Your project name can only contain ASCII letters, digits, and - or _."
            );
        }
        if (domain.indexOf(".") === -1 || domain.indexOf(" ") !== -1) {
            errors.push("Your domain name should contain at least one . and no spaces.");
        }
        if (errors.length > 0) {
            errorDiv.innerHTML =
                "<ul>" + errors.map((e) => `<li>${e}</li>`).join("") + "</ul>";
            errorDiv.style.display = "block";
            evt.preventDefault();
            return false;
        }
        return true;
    });

// Book filter logic
function setupBookFilter() {
    var filterInput = document.getElementById("bookFilter");
    var bookList = document.getElementById("bookList");
    if (!filterInput || !bookList) {
        return;
    }
    filterInput.addEventListener("input", function () {
        var filter = this.value.trim().toLowerCase();
        var entries = bookList.querySelectorAll(".book-entry");
        var sections = bookList.querySelectorAll(".book-section");
        entries.forEach(function (entry) {
            var title = entry.getAttribute("data-title") || "";
            var authors = entry.getAttribute("data-authors") || "";
            var section = entry.getAttribute("data-section") || "";
            if (
                title.includes(filter) ||
                authors.includes(filter) ||
                section.includes(filter)
            ) {
                entry.style.display = "";
            } else {
                entry.style.display = "none";
            }
        });
        // Hide section headers if no visible books in that section
        sections.forEach(function (sec) {
            var secName = sec.textContent.trim().toLowerCase();
            var visible = false;
            entries.forEach(function (entry) {
                if (
                    entry.getAttribute("data-section") === secName &&
                    entry.style.display !== "none"
                ) {
                    visible = true;
                }
            });
            sec.style.display = visible ? "" : "none";
        });
    });
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupBookFilter);
} else {
    setupBookFilter();
}
