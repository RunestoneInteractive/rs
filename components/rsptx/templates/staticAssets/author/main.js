/*
 * Javascript functions for Single Page App
 * Author: Brad Miller
 * Date: 2022-07-11
 *
 */
var taskId2Task = {};

function handleClick(type) {
    fetch("/author/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: type }),
    })
        .then((response) => response.json())
        .then((data) => {
            getStatus(data.task_id);
        });
}

// Trigger the task to clone a given repo.
// This task is implemented in worker.py
//
function cloneTask() {
    let repo = document.querySelector("#gitrepo");
    let bcname = document.querySelector("#bcname");
    fetch("/author/clone", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: repo.value, bcname: bcname.value }),
    })
        .then((response) => response.json())
        .then((data) => {
            taskId2Task[data.task_id] = `clone ${bcname.value}`;
            getStatus(data.task_id);
        });
}

// Schedule a task to build a book then follow its status
function buildTask(bcname) {
    // check to see if the generate box is checked
    let generate = document.querySelector("#generate");
    let gen = false;
    if (generate.checked) {
        gen = true;
    }
    fetch("/author/buildBook", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: bcname, generate: gen }),
    })
        .then((response) => response.json())
        .then((data) => {
            taskId2Task[data.task_id] = `build ${bcname}`;
            getStatus(data.task_id);
        });
}

function buildPTXTask() {}

// see checkDB in main.py
async function checkDB(el) {
    let response = await fetch("/author/book_in_db", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: el.value }),
    });
    if (response.ok) {
        let data = await response.json();
        let bookstatus = document.querySelector("#bookstatus");
        let addcoursebutton = document.querySelector("#addcoursebutton");
        if (data.detail) {
            bookstatus.innerHTML = "Book is in the Database";
            addcoursebutton.disabled = true;
        } else {
            bookstatus.innerHTML =
                "Please click the button to add this book to the database";
            addcoursebutton.disabled = false;
        }
    }
}

// This function is called when the "Add Book to Runestone" button is pressed
// see new_course in main.py
async function addCourse() {
    let bcname = document.querySelector("#bcname");
    if (!bcname.value) {
        alert("You must provide a document-id or base course");
        return;
    }
    let repo = document.querySelector("#gitrepo");
    if (!repo.value) {
        alert("You must provide a document-id or base course");
        return;
    }
    let response = await fetch("/author/add_course", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: bcname.value, github: repo.value }),
    });
    if (response.ok) {
        let data = await response.json();
        if (data.detail == "success") {
        }
        cloneTask();
        // if clone fails we should remove from db? - maybe add a remove button?
        // check for repo to be present.
        let i = 0;
        let iid = setInterval(async function () {
            let res = await getRepoStatus(bcname.value);
            if (res) {
                // add row for the new book.
                let row = document.createElement("tr");
                row.innerHTML = `<td>${bcname.value}</td>
                            <td><button onclick="buildTask('${bcname.value}')" type="button">Build</button></td>
                            <td><button onclick="deployTask('${bcname.value}')" type="button">Deploy</button></td>`;
                let tbl = document.getElementById("booktable");
                tbl.appendChild(row);
                clearInterval(iid);
            }
            i++;
            if (i >= 10) {
                clearInterval(iid);
            }
        }, 1000);
    }
}

function deployTask(bcname) {
    fetch("/author/deployBook", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: bcname }),
    })
        .then((response) => response.json())
        .then((data) => {
            taskId2Task[data.task_id] = `deploy ${bcname}`;
            getStatus(data.task_id);
        });
}

function useinfoTask(classname) {
    fetch("/author/dumpUseinfo", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ classname: classname }),
    })
        .then((response) => response.json())
        .then((data) => {
            taskId2Task[data.task_id] = `dump log ${classname}`;
            getStatus(data.task_id);
        });
}

function codeTask(classname) {
    fetch("/author/dumpCode", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ classname: classname }),
    })
        .then((response) => response.json())
        .then((data) => {
            taskId2Task[data.task_id] = `dump log ${classname}`;
            getStatus(data.task_id);
        });
}

function assignmentData(classname) {
    fetch(`/author/dump/assignments/${classname}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((response) => response.json())
        .then((data) => {
            let kind = "logfiles";
            fetch(`/author/dlsAvailable/${kind}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            })
                .then((response) => response.json())
                .then((res) => updateDlList(res, kind));
        });
}

function getWithAssess() {
    let withAssess = document.getElementById("with_assess");
    if (withAssess) {
        return withAssess.checked;
    } else {
        return false;
    }
}

function getStartDate() {
    let startDate = document.getElementById("start_date");
    if (startDate) {
        return startDate.value;
    } else {
        return "";
    }
}

function getEndDate() {
    let endDate = document.getElementById("end_date");
    if (endDate) {
        return endDate.value;
    } else {
        return "";
    }
}

function getSampleSize() {
    let sampleSize = document.getElementById("sample_size");
    if (sampleSize) {
        return sampleSize.value;
    } else {
        return "";
    }
}

function getIncludeBasecourse() {
    let includeBasecourse = document.getElementById("include_basecourse");
    if (includeBasecourse) {
        return includeBasecourse.checked;
    } else {
        return false;
    }
}

function getPreserveUsernames() {
    let preserveUsernames = document.getElementById("preserve_user_ids");
    if (preserveUsernames) {
        return preserveUsernames.checked;
    } else {
        return false;
    }
}

// Gets data from the form in anonymize_data.html
// This endpoint requires a valid login + author and/or researcher privileges
function startExtract() {
    // Get / Validate Form fields
    let data = {};
    data.basecourse = document.getElementById("basecourse").value;
    let basecourse = data.basecourse;
    data.with_assess = getWithAssess();
    if (getStartDate()) {
        data.start_date = getStartDate();
    }
    if (getEndDate()) {
        data.end_date = getEndDate();
    }
    data.sample_size = getSampleSize();
    data.include_basecourse = getIncludeBasecourse();

    data.specific_course = document.getElementById("specific_course").value;
    data.preserve_user_ids = getPreserveUsernames();

    if (data.specific_course) {
        validCourses = document.getElementById("clist").value.split(",");
        if (validCourses.indexOf(data.specific_course) < 0) {
            alert(
                `You are not the instructor for ${data.specific_course}. See note.`
            );
            return;
        }
        basecourse = data.specific_course;
    }
    fetch("/author/start_extract", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })
        .then((response) => response.json())
        .then((data) => {
            taskId2Task[data.task_id] = `Create Datashop for ${basecourse}`;
            getStatus(data.task_id);
        });
}

async function getRepoStatus(bcname) {
    let response = await fetch("/author/isCloned", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ bcname: bcname }),
    });
    if (response.ok) {
        let data = await response.json();
        if (data.detail == true) {
            return true;
        }
    }
    return false;
}

function showLog(book) {
    fetch(`/author/getlog/${book}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((response) => response.json())
        .then((res) => {
            let d = new Date();
            let log = document.getElementById("lastlog");
            let div = document.getElementById("lastdiv");
            div.style.display = "block";
            log.innerHTML = res.detail;
        })
        .catch((err) => console.log(err));
}

function hideLog() {
    document.getElementById("lastdiv").style.display = "none";
}

function updateDlList(res, kind) {
    let dlList = document.getElementById("csv_files_available");
    let onPage = [];
    for (const y of dlList.children) {
        var fname = y.querySelector(".logfilename");
        if (fname) {
            fname = fname.textContent;
            onPage.push(fname);
        }
    }
    for (f of res.ready_files) {
        if (onPage.indexOf(f) == -1) {
            let li = document.createElement("li");
            let a = document.createElement("a");
            // <li><a href="/getfile/{{lfile.name}}">{{lfile.name}}</a></li>
            if (kind === "datashop") {
                a.href = `/getdatashop/${f}`;
            } else {
                a.href = `/getfile/${f}`;
            }
            a.innerHTML = f;
            li.appendChild(a);
            dlList.appendChild(li);
        } else {
            if (f.indexOf(courseName) >= 0) {
                let mt = document.getElementById(`${f}_mtime`);
                let now = new Date();
                mt.innerHTML = "Today " + now.toLocaleTimeString();
            }
        }
    }
}

// This checks on the task status from a previously scheduled task.
// todo: how to report the status better
function getStatus(taskID) {
    fetch(`/author/tasks/${taskID}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((response) => response.json())
        .then((res) => {
            let d = new Date();
            let taskName = taskId2Task[taskID];
            if (!res.task_result) {
                res.task_result = {};
                if (
                    res.task_status == "SUCCESS" ||
                    res.task_status == "FAILURE"
                ) {
                    res.task_result.current = res.task_status;
                } else {
                    res.task_result.current = "Awaiting result status";
                }
            }

            const html = `
      <tr>
        <td>${taskName}</td>
        <td>${d.toLocaleString()}
        <td>${res.task_status}</td>
        <td>${res.task_result.current || "Probable Failure - Check log"}</td>
      </tr>`;
            let row = document.getElementById(`${taskID}`);
            if (!row) {
                const newRow = document.getElementById("tasks").insertRow(0);
                newRow.id = `${taskID}`;
                newRow.innerHTML = html;
            } else {
                row.innerHTML = html;
            }

            const taskStatus = res.task_status;
            if (taskStatus === "SUCCESS" || taskStatus === "FAILURE") {
                if (
                    res.task_result.current == "csv.zip file created" ||
                    res.task_result.current == "Ready for download"
                ) {
                    let kind = "datashop";
                    if (res.task_result.current == "csv.zip file created") {
                        kind = "logfiles";
                    }
                    // Get the list of files for download and add to the list.
                    fetch(`/author/dlsAvailable/${kind}`, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    })
                        .then((response) => response.json())
                        .then((res) => updateDlList(res, kind));
                }
                return false;
            }
            setTimeout(function () {
                getStatus(res.task_id);
            }, 1000);
        })
        .catch((err) => console.log(err));
}
