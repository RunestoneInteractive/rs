/* Page-completion tracking: the "Mark as Completed" button, the last-page
 * bookmark, and the table-of-contents progress decorations. (The file name
 * is historical.) */

"use strict";

import { outerWidth, animate } from "./domutil.js";
import "../css/user-highlights.css";

/*
 * GET a server endpoint that answers either JSON or the literal string
 * "None". Returns the parsed JSON or null.
 */
async function fetchJson(url, params) {
    let fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;
    try {
        let response = await fetch(fullUrl);
        if (!response.ok) {
            console.log("Request Failed for " + fullUrl);
            return null;
        }
        let text = await response.text();
        if (text == "None" || text === "") {
            return null;
        }
        return JSON.parse(text);
    } catch (err) {
        console.log("Request Failed for " + fullUrl);
        console.log(err);
        return null;
    }
}

async function getCompletions() {
    // Get the completion status
    if (
        window.location.href.match(
            /(\/index.html|toctree.html|genindex.html|navhelp.html|toc.html|assignments.html|Exercises.html)/,
        )
    ) {
        return;
    }

    var currentPathname = window.location.pathname;
    if (currentPathname.indexOf("?") !== -1) {
        currentPathname = currentPathname.substring(
            0,
            currentPathname.lastIndexOf("?"),
        );
    }
    var data = await fetchJson(
        `${eBookConfig.new_server_prefix}/logger/getCompletionStatus`,
        {
            lastPageUrl: currentPathname,
            isPtxBook: isPreTeXt(),
        },
    );
    if (data) {
        var completionData = data.detail;
        var completionClass, completionMsg;
        if (completionData[0].completionStatus == 1) {
            completionClass = "buttonConfirmCompletion";
            completionMsg =
                "<i class='glyphicon glyphicon-ok'></i> Completed. Well Done!";
        } else {
            completionClass = "buttonAskCompletion";
            completionMsg = "Mark as Completed";
        }
        let scp = document.querySelector("#scprogresscontainer");
        if (scp) {
            scp.classList.add("ptx-runestone-container");
            scp.insertAdjacentHTML(
                "beforeend",
                '<div style="text-align:center"><button class="btn btn-lg ' +
                    completionClass +
                    '" id="completionButton">' +
                    completionMsg +
                    "</button></div>",
            );
        }
    }
}

function showLastPositionBanner() {
    var lastPositionVal = getUrlVar("lastPosition");
    if (lastPositionVal !== null) {
        document.body.insertAdjacentHTML(
            "beforeend",
            '<img src="../_static/last-point.png" style="position:absolute; padding-top:55px; left: 10px; top: ' +
                parseInt(lastPositionVal) +
                'px;"/>',
        );
        window.scrollTo({
            top: parseInt(lastPositionVal),
            behavior: "smooth",
        });
    }
}

function addNavigationAndCompletionButtons() {
    if (
        window.location.href.match(
            /(index.html|genindex.html|navhelp.html|toc.html|assignments.html|Exercises.html|toctree.html)/,
        )
    ) {
        return;
    }
    var completionButton = document.getElementById("completionButton");
    var navLinkBgRight = document.getElementById("navLinkBgRight");
    var navLinkBgLeft = document.getElementById("navLinkBgLeft");
    var relationsNext = document.getElementById("relations-next");
    var navLinkBgRightHiddenPosition = navLinkBgRight
        ? -outerWidth(navLinkBgRight) - 5
        : -5;
    var navLinkBgRightHalfOpen;
    var navLinkBgRightFullOpen = 0;

    if (completionButton?.classList.contains("buttonAskCompletion")) {
        navLinkBgRightHalfOpen = navLinkBgRightHiddenPosition + 70;
    } else if (
        completionButton?.classList.contains("buttonConfirmCompletion")
    ) {
        navLinkBgRightHalfOpen = 0;
    }
    var relationsNextIconInitialPosition = relationsNext
        ? getComputedStyle(relationsNext).right
        : "0px";
    var relationsNextIconNewPosition = -(navLinkBgRightHiddenPosition + 35);

    if (navLinkBgRight) {
        navLinkBgRight.style.right = navLinkBgRightHiddenPosition + "px";
        navLinkBgRight.style.display = "";
        var navBgShown = false;
        window.addEventListener("scroll", function () {
            if (
                window.scrollY + window.innerHeight >=
                document.documentElement.scrollHeight
            ) {
                animate(
                    navLinkBgRight,
                    { right: navLinkBgRightHalfOpen },
                    { duration: 200 },
                );
                if (navLinkBgLeft) {
                    animate(navLinkBgLeft, { left: 0 }, { duration: 200 });
                }
                if (
                    relationsNext &&
                    completionButton?.classList.contains(
                        "buttonConfirmCompletion",
                    )
                ) {
                    animate(
                        relationsNext,
                        { right: relationsNextIconNewPosition },
                        { duration: 200 },
                    );
                }
                navBgShown = true;
            } else if (navBgShown) {
                animate(
                    navLinkBgRight,
                    { right: navLinkBgRightHiddenPosition },
                    { duration: 200 },
                );
                if (navLinkBgLeft) {
                    animate(navLinkBgLeft, { left: -65 }, { duration: 200 });
                }
                if (relationsNext) {
                    animate(relationsNext, {
                        right: relationsNextIconInitialPosition,
                    });
                }
                navBgShown = false;
            }
        });
    }

    var completionFlag = 0;
    if (completionButton?.classList.contains("buttonAskCompletion")) {
        completionFlag = 0;
    } else {
        completionFlag = 1;
    }
    // Make sure we mark this page as visited regardless of how flakey
    // the onunload handlers become.
    processPageState(completionFlag, true, false, false);
    completionButton?.addEventListener("click", function () {
        var markingComplete = false;
        var markingIncomplete = false;
        if (completionButton.classList.contains("buttonAskCompletion")) {
            completionButton.classList.remove("buttonAskCompletion");
            completionButton.classList.add("buttonConfirmCompletion");
            completionButton.innerHTML =
                "<i class='glyphicon glyphicon-ok'></i> Completed. Well Done!";
            if (navLinkBgRight) {
                animate(navLinkBgRight, { right: navLinkBgRightFullOpen });
            }
            if (relationsNext) {
                animate(relationsNext, {
                    right: relationsNextIconNewPosition,
                });
            }
            navLinkBgRightHalfOpen = 0;
            completionFlag = 1;
            markingComplete = true;
        } else if (
            completionButton.classList.contains("buttonConfirmCompletion")
        ) {
            completionButton.classList.remove("buttonConfirmCompletion");
            completionButton.classList.add("buttonAskCompletion");
            completionButton.innerHTML = "Mark as Completed";
            navLinkBgRightHalfOpen = navLinkBgRightHiddenPosition + 70;
            if (navLinkBgRight) {
                animate(navLinkBgRight, { right: navLinkBgRightHalfOpen });
            }
            if (relationsNext) {
                animate(relationsNext, {
                    right: relationsNextIconInitialPosition,
                });
            }
            completionFlag = 0;
            markingIncomplete = true;
        }
        processPageState(
            completionFlag,
            false,
            markingComplete,
            markingIncomplete,
        );
    });
}

// _ decorateTableOfContents
// -------------------------
async function decorateTableOfContents() {
    if (
        window.location.href.toLowerCase().indexOf("toc.html") != -1 ||
        window.location.href.toLowerCase().indexOf("index.html") != -1 ||
        window.location.href.toLowerCase().indexOf("frontmatter") != -1
    ) {
        if (!isPreTeXt()) {
            let data = await fetchJson(
                `${eBookConfig.new_server_prefix}/logger/getAllCompletionStatus`,
            );
            if (data) {
                let subChapterList = data.detail;
                let allSubChapterURLs = document.querySelectorAll(
                    "#main-content div li a",
                );
                for (let item of subChapterList) {
                    for (var s = 0; s < allSubChapterURLs.length; s++) {
                        if (
                            allSubChapterURLs[s].href.indexOf(
                                item.chapterName + "/" + item.subChapterName,
                            ) != -1
                        ) {
                            if (item.completionStatus == 1) {
                                decorateTocEntry(
                                    allSubChapterURLs[s].parentElement,
                                    "completed",
                                    "infoTextCompleted",
                                    "- Completed this topic on " + item.endDate,
                                );
                            } else if (item.completionStatus == 0) {
                                decorateTocEntry(
                                    allSubChapterURLs[s].parentElement,
                                    "active",
                                    "infoTextActive",
                                    "Last read this topic on " + item.endDate,
                                );
                            }
                        }
                    }
                }
            }
        }
        let lastPage = await fetchJson(
            `${eBookConfig.new_server_prefix}/logger/getlastpage`,
            { course: eBookConfig.course },
        );
        if (lastPage) {
            let lastPageData = lastPage.detail;
            if (lastPageData.lastPageChapter != null) {
                let continueReading =
                    document.getElementById("continue-reading");
                if (continueReading) {
                    continueReading.style.display = "";
                    continueReading.innerHTML =
                        '<div id="jump-to-chapter" class="alert alert-info" ><strong>You were Last Reading:</strong> ' +
                        lastPageData.lastPageChapter +
                        (lastPageData.lastPageSubchapter
                            ? " &gt; " + lastPageData.lastPageSubchapter
                            : "") +
                        ' <a href="' +
                        lastPageData.lastPageUrl +
                        "?lastPosition=" +
                        lastPageData.lastPageScrollLocation +
                        '">Continue Reading</a></div>';
                }
            }
        }
    }
}

/*
 * Add a status class and a hover-revealed date annotation to one entry in
 * the table of contents.
 */
function decorateTocEntry(entry, entryClass, infoClass, infoText) {
    entry.classList.add(entryClass);
    let info = document.createElement("span");
    info.className = infoClass;
    info.textContent = infoText;
    entry.appendChild(info);
    let link = entry.children[0];
    if (link && link !== info) {
        link.addEventListener("mouseenter", function () {
            info.style.display = "";
        });
        link.addEventListener("mouseleave", function () {
            info.style.display = "none";
        });
    }
}

async function enableCompletions() {
    // The completion button must exist before the navigation logic looks
    // for it (the jQuery version used a synchronous request here).
    await getCompletions();
    showLastPositionBanner();
    addNavigationAndCompletionButtons();
    await decorateTableOfContents();
}

// call enable user highlights after login
document.addEventListener("runestone:login", enableCompletions);

function isPreTeXt() {
    let ptxMarker = document.querySelector("body.pretext");
    if (ptxMarker) {
        return true;
    } else {
        return false;
    }
}
// _ processPageState
// -------------------------
async function processPageState(
    completionFlag,
    pageLoad,
    markingComplete,
    markingIncomplete,
) {
    /*Log last page visited*/
    var currentPathname = window.location.pathname;
    if (currentPathname.indexOf("?") !== -1) {
        currentPathname = currentPathname.substring(
            0,
            currentPathname.lastIndexOf("?"),
        );
    }
    // Is this a ptx book?
    let isPtxBook = isPreTeXt();
    var data = {
        lastPageUrl: currentPathname,
        lastPageScrollLocation: Math.round(window.scrollY),
        completionFlag: completionFlag,
        pageLoad: pageLoad,
        markingComplete: markingComplete,
        markingIncomplete: markingIncomplete,
        course: eBookConfig.course,
        isPtxBook: isPtxBook,
    };
    let url = `${eBookConfig.new_server_prefix}/logger/updatelastpage`;
    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(data),
        });
    } catch (err) {
        console.log("Request Failed for " + url);
        console.log(err);
    }
}

function getUrlVar(name) {
    return new URLSearchParams(window.location.search).get(name);
}
