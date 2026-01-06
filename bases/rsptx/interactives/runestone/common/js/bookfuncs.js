/**
 *
 * User: bmiller
 * Original: 2011-04-20
 * Date: 2019-06-14
 * Time: 2:01 PM
 * This change marks the beginning of version 4.0 of the runestone components
 * Login/logout is no longer handled through javascript but rather server side.
 * Many of the components depend on the runestone:login event so we will keep that
 * for now to keep the churn fairly minimal.
 */

/*

 Copyright (C) 2011  Brad Miller  bonelake@gmail.com

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.

 */

//
// Page decoration functions
//
/*
Maybe something like this at the top:

Active assignment: [Ch 15 reading]      [Exit assignment link]
On page (3 of 7) [Select input showing current page, can select others] 
Becoming this if not on a page in assignment

Active assignment: [Ch 15 reading]      [Exit assignment link]
This page is not part of that assignment. Select a page to return to it:
[Select input]
*/
function addReadingList() {
    let assignment_info_string = localStorage.getItem("currentAssignmentInfo")
        
    if (assignment_info_string && eBookConfig.readings) {
        var top,bottom,active,page_name,exit_link,fst,snd, new_pos, path_parts, new_pos_link;
        let assignment_info = JSON.parse(assignment_info_string);
        let assignment_id = assignment_info.id;
        let assignment_name = assignment_info.name;
        let reading_names = assignment_info.readings;

        active = document.createElement("div");
        active.textContent = "Active assignment: "

        page_name = document.createElement("a");
        page_name.textContent = assignment_name;
        page_name.href = `/assignment/student/doAssignment?assignment_id=${assignment_id}`;
        
        active.append(page_name);

        exit_link = document.createElement("a");
        exit_link.textContent = "Exit Assignment";
        exit_link.href=window.location.pathname;

        exit_link.addEventListener('click',function(event) {
            localStorage.removeItem("currentAssignmentInfo");
        });

        //active.append(exit_link)

        let cur_path_parts = window.location.pathname.split("/");
        let name =
            cur_path_parts[cur_path_parts.length - 2] +
            "/" +
            cur_path_parts[cur_path_parts.length - 1];
        // if body has pretext class, then strip the leading path parts from each of the strings in eBookConfig.readings
        let body = document.getElementsByTagName("body")[0];
        let ptxbook = false;
        let endLop = 2;
        if (body.classList.contains("pretext")) {
            ptxbook = true;
            eBookConfig.readings = eBookConfig.readings.map(r => r.split("/").pop());
            name = name.split("/").pop();
            endLop = 1;
        }

        let position = eBookConfig.readings.indexOf(name);
        let num_readings = eBookConfig.readings.length;
        // get prev name
        if (position > 0) {
            new_pos = eBookConfig.readings[position - 1];
            path_parts = cur_path_parts.slice(0, cur_path_parts.length - endLop);
            path_parts.push(new_pos);
            new_pos_link = path_parts.join("/");
            fst = active.cloneNode(true);
            let txt = document.createTextNode(`, Page ${position + 1} of ${num_readings}, `);
            var fst_lnk = document.createElement("a");
            //fst_lnk.className = "btn btn-lg reading-navigation prev-reading";
            fst_lnk.href = new_pos_link;
            fst_lnk.textContent = `Back to page ${
                position
            } of ${num_readings}: ${reading_names[position-1]}.`;
            fst.append(txt);
            fst.append(fst_lnk);
        } else if (position == 0){
            fst = active.cloneNode(true);
            let txt = document.createTextNode(`, Page 1 of ${num_readings}.`);
            fst.append(txt);
        } else {
            new_pos = eBookConfig.readings[0];
            path_parts = cur_path_parts.slice(0, cur_path_parts.length - endLop);
            path_parts.push(new_pos);
            new_pos_link = path_parts.join("/");
            fst = active.cloneNode(true);
            let txt = document.createTextNode(", Notice: this page is not part of the assignment. To remove this warning click ");
            fst.append(txt);
            fst.append(exit_link);
        }
        if (position == eBookConfig.readings.length - 1) {
            // no more readings
            snd = active;
            let txt = document.createTextNode(`, Page ${num_readings} of ${num_readings}: ${reading_names[position]}`);
            snd.append(txt);
        } else if (position >= 0) {
            // get next name
            new_pos = eBookConfig.readings[position + 1];
            path_parts = cur_path_parts.slice(0, cur_path_parts.length - endLop);
            path_parts.push(new_pos);
            new_pos_link = path_parts.join("/");
            snd = active;
            var snd_lnk = document.createElement("a");
            //snd_lnk.className = "btn btn-lg reading-navigation next-reading";
            snd_lnk.href = new_pos_link;
            snd_lnk.textContent = `Continue to page ${
                position + 2
            } of ${num_readings}: ${reading_names[position+1]}`;
            let txt = document.createTextNode(", ");
            snd.append(txt);
            snd.append(snd_lnk);
        } else {
            snd = active.cloneNode(true);
            let txt = document.createTextNode(", Notice: this page is not part of the assignment. To remove this warning click ");
            snd.append(txt);
            let exit_clone = exit_link.cloneNode(true);

            exit_clone.addEventListener('click',function(event) {
                localStorage.removeItem("currentAssignmentInfo");
            });
            snd.append(exit_clone);

        }

        top = document.createElement("div");
        top.style.backgroundColor = "var(--componentBgColor)"
        top.style.borderColor = "var(--componentBorderColor)"
        top.style.borderWidth = "1px"
        top.append(fst);
        //top.append(snd);

        bottom = document.createElement("div");
        bottom.style.backgroundColor = "var(--componentBgColor)"
        bottom.style.borderColor = "var(--componentBorderColor)"
        bottom.style.borderWidth = "1px"
        
        //bottom.append(active.cloneNode(true));
        //bottom.append(fst.cloneNode(true));
        bottom.append(snd);


        // check the body tag to see if it has a pretext class (no jquery)
        if (ptxbook) {
            //append parts to the header and progress container
            let content = document.getElementById("ptx-content");
            if (content) {
                content.insertBefore(top, content.firstChild);
            }
            let pc = document.getElementById("scprogresscontainer");
            if (pc) {
                pc.style.marginBottom = "20px";
                pc.appendChild(bottom);
            }
            return;
        }
        const mainContent = document.getElementById("main-content");
        if (mainContent && snd) {
            mainContent.insertBefore(top,mainContent.firstChild)
            mainContent.appendChild(bottom);
            
        }
    }
}

function timedRefresh() {
    var timeoutPeriod = 900000; // 75 minutes
    let idleTimeoutId;

    function onIdle() {
        // After timeout period send the user back to the index.  This will force a login
        // if needed when they want to go to a particular page.  This may not be perfect
        // but its an easy way to make sure laptop users are properly logged in when they
        // take quizzes and save stuff.
        if (location.href.indexOf("index.html") < 0) {
            console.log("Idle timer - " + location.pathname);
            location.href =
                eBookConfig.app +
                "/default/user/login?_next=" +
                location.pathname +
                location.search;
        }
    }

    function resetIdleTimer() {
        if (idleTimeoutId) {
            clearTimeout(idleTimeoutId);
        }
        idleTimeoutId = setTimeout(onIdle, timeoutPeriod);
    }

    ["mousemove", "keydown", "scroll", "click", "touchstart", "wheel"].forEach(
        (eventName) => {
            window.addEventListener(eventName, resetIdleTimer, { passive: true });
        },
    );

    resetIdleTimer();
}

class PageProgressBar {
    constructor(actDict) {
        this.possible = 0;
        this.total = 1;
        if (actDict && "assignment_spec" in actDict) {
            this.assignment_spec = actDict.assignment_spec;
            delete actDict.assignment_spec;
        }
        if (actDict && Object.keys(actDict).length > 0) {
            this.activities = actDict;
        } else {
            let activities = { page: 0 };
            document.querySelectorAll(".runestone").forEach(function (e) {
                activities[e.firstElementChild.id] = 0;
            });
            this.activities = activities;
        }
        this.calculateProgress();
        // Hide the progress bar on the index page.
        if (
            window.location.pathname.match(
                /.*\/(index.html|toctree.html|Exercises.html|search.html)$/i,
            )
        ) {
            const scprogresscontainer = document.getElementById(
                "scprogresscontainer",
            );
            if (scprogresscontainer) scprogresscontainer.style.display = "none";
        }
        this.renderProgress();
    }

    calculateProgress() {
        for (let k in this.activities) {
            if (k !== undefined) {
                this.possible++;
                if (this.activities[k] > 0) {
                    this.total++;
                }
            }
        }
    }

    renderProgress() {
        let value = 0;
        const scprogresstotal = document.getElementById("scprogresstotal");
        if (scprogresstotal) scprogresstotal.textContent = this.total;
        const scprogressposs = document.getElementById("scprogressposs");
        if (scprogressposs) scprogressposs.textContent = this.possible;
        try {
            value = (100 * this.total) / this.possible;
        } catch (e) {
            value = 0;
        }
        // Replace #subchapterprogress div with a native <progress> element if not already done
        let subchapterprogress = document.getElementById("subchapterprogress");
        if (subchapterprogress && subchapterprogress.tagName !== "PROGRESS") {
            // Replace the div with a <progress> element
            const progressElem = document.createElement("progress");
            progressElem.id = "subchapterprogress";
            progressElem.max = 100;
            progressElem.value = value;
            // Copy over any classes from the old div
            progressElem.className = subchapterprogress.className;
            subchapterprogress.replaceWith(progressElem);
            subchapterprogress = progressElem;
        } else if (subchapterprogress) {
            subchapterprogress.max = 100;
            subchapterprogress.value = value;
        }
        if (this.assignment_spec) {
            // If the user has completed all activities, send the reading score.
            // This handles the case where there are no activities on the page or
            //  where the user completed activities on the assignment page and now
            //  is viewing the reading page.
            let completeActivities = this.total - 1; // subtract 1 for the page reading which is in total but not an activity
            let requiredActivities =
                this.assignment_spec.activities_required || 0;
            if (completeActivities >= requiredActivities) {
                this.sendCompletedReadingScore().then(() => {
                    console.log("Reading score sent for page");
                    // wait a tick then mark the page complete
                    // this is needed to let the progress bar update before marking complete
                    setTimeout(() => {
                        let cb = document.getElementById("completionButton");
                        if (
                            cb &&
                            cb.textContent.toLowerCase() === "mark as completed"
                        ) {
                            cb.click();
                        }
                    }, 500);
                });
            }
        }
        if (!eBookConfig.isLoggedIn) {
            const subchapterDiv = document.getElementById("subchapterprogress");
            if (subchapterDiv) subchapterDiv.classList.add("loggedout");
        }
    }

    updateProgress(div_id) {
        this.activities[div_id]++;
        // Only update the progress bar on the first interaction with an object.
        if (this.activities[div_id] === 1) {
            this.total++;
            let val = (100 * this.total) / this.possible;
            const scprogresstotal2 = document.getElementById("scprogresstotal");
            if (scprogresstotal2) scprogresstotal2.textContent = this.total;
            const scprogressposs2 = document.getElementById("scprogressposs");
            if (scprogressposs2) scprogressposs2.textContent = this.possible;
            let subchapterprogress2 =
                document.getElementById("subchapterprogress");
            if (
                subchapterprogress2 &&
                subchapterprogress2.tagName === "PROGRESS"
            ) {
                subchapterprogress2.value = val;
            }
            if (
                this.assignment_spec &&
                this.assignment_spec.activities_required !== null &&
                this.total >= this.assignment_spec.activities_required
            ) {
                console.log("Required activities completed");
                this.sendCompletedReadingScore().then(() => {
                    console.log("Reading score sent");
                });
            }
            if (
                val == 100.0 &&
                (function () {
                    const cb = document.getElementById("completionButton");
                    return (
                        cb &&
                        cb.textContent &&
                        cb.textContent.toLowerCase() === "mark as completed"
                    );
                })()
            ) {
                const cb = document.getElementById("completionButton");
                if (cb && typeof cb.click === "function") {
                    cb.click();
                }
            }
        }
    }

    async sendCompletedReadingScore() {
        let headers = new Headers({
            "Content-type": "application/json; charset=utf-8",
            Accept: "application/json",
        });
        let data = { ...this.assignment_spec };
        let request = new Request(
            `${eBookConfig.new_server_prefix}/logger/update_reading_score`,
            {
                method: "POST",
                body: JSON.stringify(data),
                headers: headers,
            },
        );
        try {
            let response = await fetch(request);
            if (!response.ok) {
                console.error(
                    `Failed to send reading score! ${response.statusText}`,
                );
            }
            data = await response.json();
        } catch (e) {
            console.error(`Error sending reading score ${e}`);
        }
    }
}

export var pageProgressTracker = {};

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
}

async function handlePageSetup() {
    var mess;
    if (eBookConfig.useRunestoneServices) {
        let headers = new Headers({
            "Content-type": "application/json; charset=utf-8",
            Accept: "application/json",
        });
        let data = {
            timezoneoffset: new Date().getTimezoneOffset() / 60,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        let RS_info = getCookie("RS_info");
        var tz_match = false;
        if (RS_info) {
            try {
                let cleaned = RS_info.replace(/\\054/g, ","); // handle octal comma encoding
                let info = JSON.parse(decodeURIComponent(cleaned));
                info = JSON.parse(decodeURIComponent(info));
                if (
                    info.timezone === data.timezone &&
                    info.tz_offset === data.timezoneoffset
                ) {
                    console.log(
                        "Timezone cookie matches, not sending timezone to server",
                    );
                    tz_match = true;
                }
            } catch (e) {
                console.error(
                    "Error parsing RS_info cookie, sending timezone to server",
                );
            }
        }
        if (tz_match === false) {
            // Set a cookie so we don't have to do this again for a while.
            let request = new Request(
                `${eBookConfig.new_server_prefix}/logger/set_tz_offset`,
                {
                    method: "POST",
                    body: JSON.stringify(data),
                    headers: headers,
                },
            );
            try {
                let response = await fetch(request);
                if (!response.ok) {
                    console.error(
                        `Failed to set timezone! ${response.statusText}`,
                    );
                }
                data = await response.json();
            } catch (e) {
                console.error(`Error setting timezone ${e}`);
            }
        }
    }
    console.log(`This page served by ${eBookConfig.served_by}`);
    if (eBookConfig.isLoggedIn) {
        mess = `username: ${eBookConfig.username}`;
        if (!eBookConfig.isInstructor) {
            const ipDropdown = document.getElementById("ip_dropdown_link");
            if (ipDropdown && typeof ipDropdown.remove === "function") {
                ipDropdown.remove();
            }
            const instPeer = document.getElementById("inst_peer_link");
            if (instPeer && typeof instPeer.remove === "function") {
                instPeer.remove();
            }
        }
        document.dispatchEvent(new Event("runestone:login"));
        addReadingList();
        // Avoid the timedRefresh on the grading page.
        if (
            window.location.pathname.indexOf("/admin/grading") == -1 &&
            window.location.pathname.indexOf("/peer/") == -1
        ) {
            timedRefresh();
        }
    } else {
        mess = "Not logged in";
        document.dispatchEvent(new Event("runestone:logout"));
        let bw = document.getElementById("browsing_warning");
        if (bw) {
            bw.innerHTML =
                "<p class='navbar_message'>Saving and Logging are Disabled</p>";
        }
        let aw = document.getElementById("ad_warning");
        if (aw) {
            aw.innerHTML =
                "<p class='navbar_message'>🚫 Log-in to Remove <a href='/runestone/default/ads'>Ads!</a> 🚫 &nbsp;</p>";
        }
    }
    document.querySelectorAll(".loggedinuser").forEach((el) => {
        el.innerHTML = mess;
    });

    pageProgressTracker = new PageProgressBar(eBookConfig.activities);
    notifyRunestoneComponents();
}

function setupNavbarLoggedIn() {
    const profileLink = document.getElementById("profilelink");
    if (profileLink) profileLink.style.removeProperty("display");
    const passwordLink = document.getElementById("passwordlink");
    if (passwordLink) passwordLink.style.removeProperty("display");
    const registerLink = document.getElementById("registerlink");
    if (registerLink) registerLink.style.display = "none";
    document.querySelectorAll("li.loginout").forEach((el) => {
        el.innerHTML =
            '<a href="' +
            eBookConfig.app +
            '/default/user/logout">Log Out</a>';
    });
}
document.addEventListener("runestone:login", setupNavbarLoggedIn);

function setupNavbarLoggedOut() {
    if (eBookConfig.useRunestoneServices) {
        console.log("setup navbar for logged out");
        const registerLink = document.getElementById("registerlink");
        if (registerLink) registerLink.style.removeProperty("display");
        const profileLink = document.getElementById("profilelink");
        if (profileLink) profileLink.style.display = "none";
        const passwordLink = document.getElementById("passwordlink");
        if (passwordLink) passwordLink.style.display = "none";
        const ipDropdown = document.getElementById("ip_dropdown_link");
        if (ipDropdown) ipDropdown.style.display = "none";
        const instPeer = document.getElementById("inst_peer_link");
        if (instPeer) instPeer.style.display = "none";
        document.querySelectorAll("li.loginout").forEach((el) => {
            el.innerHTML =
                '<a href="' +
                eBookConfig.app +
                '/default/user/login">Login</a>';
        });
        document.querySelectorAll(".footer").forEach((el) => {
            el.innerHTML = "user not logged in";
        });
    }
}
document.addEventListener("runestone:logout", setupNavbarLoggedOut);

function notifyRunestoneComponents() {
    // Runestone components wait until login process is over to load components because of storage issues. This triggers the `dynamic import machinery`, which then sends the login complete signal when this and all dynamic imports are finished.
    console.log("triggering runestone:pre-login-complete");
    document.dispatchEvent(new Event("runestone:pre-login-complete"));
}

function placeAdCopy() {
    if (typeof showAd !== "undefined" && showAd) {
        let adNum = Math.floor(Math.random() * 2) + 1;
        let adBlock = document.getElementById(`adcopy_${adNum}`);
        let rsElements = document.querySelectorAll(".runestone");
        if (rsElements.length > 0) {
            let randomIndex = Math.floor(Math.random() * rsElements.length);
            rsElements[randomIndex].after(adBlock);
            adBlock.style.display = "block";
        }
    }
}

// initialize stuff
document.addEventListener("DOMContentLoaded", function () {
    if (eBookConfig) {
        handlePageSetup();
        placeAdCopy();
    } else {
        if (typeof eBookConfig === "undefined") {
            console.log(
                "eBookConfig is not defined.  This page must not be set up for Runestone",
            );
        }
    }
});

// misc stuff
// todo:  This could be further distributed but making a video.js file just for one function seems dumb.
window.addEventListener("load", function () {
    // add the video play button overlay image
    document.querySelectorAll(".video-play-overlay").forEach(function (el) {
        el.style.backgroundImage =
            "url('{{pathto('_static/play_overlay_icon.png', 1)}}')";
    });

    // This function is needed to allow the dropdown search bar to work;
    // The default behaviour is that the dropdown menu closes when something in
    // it (like the search bar) is clicked
    document
        .querySelectorAll(".dropdown input, .dropdown label")
        .forEach(function (el) {
            el.addEventListener("click", function (e) {
                e.stopPropagation();
            });
        });

    // re-write some urls
    // This is tricker than it looks and you have to obey the rules for # anchors
    // The #anchors must come after the query string as the server basically ignores any part
    // of a url that comes after # - like a comment...
    if (location.href.includes("mode=browsing")) {
        let queryString = "?mode=browsing";
        document.querySelectorAll("a").forEach((link) => {
            let anchorText = "";
            if (
                link.href.includes("books/published") &&
                !link.href.includes("?mode=browsing")
            ) {
                if (link.href.includes("#")) {
                    let aPoint = link.href.indexOf("#");
                    anchorText = link.href.substring(aPoint);
                    link.href = link.href.substring(0, aPoint);
                }
                link.href = link.href.includes("?")
                    ? link.href + queryString.replace("?", "&") + anchorText
                    : link.href + queryString + anchorText;
            }
        });
    }
});

/**
 * Returns true if the string appears to contain LaTeX math.
 */
export function looksLikeLatexMath(text) {
    if (typeof text !== "string") return false;

    // Common LaTeX math delimiters
    const mathDelimiters = [
        /\$\$[\s\S]+?\$\$/, // $$ ... $$
        /\$[^$\n]+?\$/, // $ ... $
        /\\\[[\s\S]+?\\\]/, // \[ ... \]
        /\\\([\s\S]+?\\\)/, // \( ... \)
    ];

    // Common math commands (avoid generic \text or \ref-only cases)
    const mathCommands =
        /\\(frac|sqrt|sum|prod|int|lim|sin|cos|tan|log|ln|alpha|beta|gamma|pi|theta|sigma|Delta|cdot|times|leq|geq|neq)\b/;

    // Superscripts/subscripts like x^2 or a_i
    const superSubScript = /[a-zA-Z0-9]\s*[\^_]\s*\{?.+?\}?/;

    return (
        mathDelimiters.some((re) => re.test(text)) ||
        mathCommands.test(text) ||
        superSubScript.test(text)
    );
}
