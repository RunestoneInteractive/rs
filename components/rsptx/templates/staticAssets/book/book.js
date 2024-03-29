//This is the JavaScript function of the search bar of the library

function search_book() {
    let input = document.getElementById("searchbar").value;
    input = input.toLowerCase();
    let x = document.getElementsByClassName("book_title");
    let y = document.getElementsByClassName("book_descript");

    for (i = 0; i < x.length; i++) {
        if (
            x[i].innerHTML.toLowerCase().includes(input) ||
            y[i].innerHTML.toLowerCase().includes(input)
        ) {
            x[i].parentElement.style.display = "list-item";
            x[i].parentElement.previousElementSibling.style.display =
                "list-item";
            y[i].parentElement.style.display = "list-item";
            y[i].parentElement.previousElementSibling.style.display =
                "list-item";
        } else {
            x[i].parentElement.style.display = "none";
            y[i].parentElement.style.display = "none";
        }
    }

    // remove section headings when searching - restore when the search box is empty
    let sections = document.querySelectorAll(".sectionName");
    sections.forEach((sec) => {
        sec.style.display = input ? "none" : "list-item";
    });
}
