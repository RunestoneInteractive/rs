/* My Courses (admin/auth/my_courses.html) — client-side course filtering.
 *
 * The filter box is only rendered when the user has enough courses to make
 * scanning the list tedious, so bail out quietly when it is absent.
 */

(function () {
  const filterBox = document.getElementById("courseFilter");
  if (!filterBox) return;

  const clearBtn = document.getElementById("courseFilterClear");
  const statusLine = document.getElementById("filterStatus");
  const noMatches = document.getElementById("noMatches");
  const rows = Array.from(document.querySelectorAll(".course-row"));
  const sections = Array.from(document.querySelectorAll(".course-section"));

  function applyFilter() {
    const needle = filterBox.value.trim().toLowerCase();
    let shown = 0;
    rows.forEach(function (row) {
      const match = !needle || (row.dataset.courseName || "").includes(needle);
      row.style.display = match ? "" : "none";
      if (match) shown++;
    });

    // While filtering, hide a whole section once none of its courses match.
    // Sections that were empty to begin with keep their "you have no…"
    // notice so the page still explains itself when the filter is cleared.
    sections.forEach(function (section) {
      const sectionRows = section.querySelectorAll(".course-row");
      const anyVisible = Array.from(sectionRows).some(
        (r) => r.style.display !== "none",
      );
      const hide = needle && sectionRows.length > 0 && !anyVisible;
      section.style.display = hide ? "none" : "";
    });

    if (noMatches) noMatches.hidden = !needle || shown > 0;
    if (statusLine) {
      statusLine.hidden = !needle;
      statusLine.textContent =
        "Showing " + shown + " of " + rows.length + " courses.";
    }
  }

  function clearFilter() {
    filterBox.value = "";
    applyFilter();
    filterBox.focus();
  }

  filterBox.addEventListener("input", applyFilter);
  filterBox.addEventListener("keydown", function (e) {
    if (e.key === "Escape") clearFilter();
  });
  if (clearBtn) clearBtn.addEventListener("click", clearFilter);
})();
