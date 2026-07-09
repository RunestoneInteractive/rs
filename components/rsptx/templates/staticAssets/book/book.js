// This is the JavaScript function of the search bar of the library.
// A book matches when every word typed appears somewhere in the book's
// title, author(s), description, or base course name (the `data-search`
// attribute built in the template holds all four fields, lower-cased).

function search_book() {
    let input = document.getElementById("searchbar").value.toLowerCase();
    let words = input.split(/\s+/).filter((w) => w.length > 0);

    let sections = document.querySelectorAll("details");
    let totalMatches = 0;

    sections.forEach((sec) => {
        let entries = sec.querySelectorAll(".library_entry");
        let sectionMatches = 0;

        entries.forEach((entry) => {
            let haystack = entry.getAttribute("data-search") || "";
            // Match only when every word is found somewhere in the fields.
            let matches = words.every((w) => haystack.includes(w));
            entry.style.display = matches ? "" : "none";
            if (matches) {
                sectionMatches++;
            }
        });
        totalMatches += sectionMatches;

        if (words.length === 0) {
            // Empty box: restore the original collapsed sections.
            sec.style.display = "";
            sec.removeAttribute("open");
        } else if (sectionMatches > 0) {
            // Open any section that has a match, even if it was closed.
            sec.style.display = "";
            sec.setAttribute("open", "");
        } else {
            // Hide sections with no matches while searching.
            sec.style.display = "none";
        }
    });

    let noResults = document.getElementById("search_no_results");
    if (noResults) {
        noResults.style.display =
            words.length > 0 && totalMatches === 0 ? "block" : "none";
    }
}
