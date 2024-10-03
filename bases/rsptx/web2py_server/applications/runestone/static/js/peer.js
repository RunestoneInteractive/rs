var ws = null;
var alertSet = false;
function connect(event) {
    ws = new WebSocket(`${eBookConfig.websocketUrl}/chat/${user}/ws`);
    messageTrail = {};
    if (ws) {
        console.log(`Websocket Connected: ${ws}`);
    }

    ws.onclose = function () {
        console.log("Websocket Closed")
        alert(
            "You have been disconnected from the peer instruction server. Will Reconnect."
        );
        connect();
    };

    ws.onmessage = function (event) {
        var messages = document.getElementById("messages");
        var message = document.createElement("li");
        message.classList.add("incoming-mess");
        let mess = JSON.parse(event.data);
        // This is an easy to code solution for broadcasting that could go out to
        // multiple courses.  It would be better to catch that on the server side
        // but that will take a bit more work and research
        if (mess.course_name != eBookConfig.course) {
            console.log(`ignoring message to ${mess.course_name}`);
            return;
        }
        if (mess.type === "text") {
            if (!(mess.time in messageTrail)) {
                var content = document.createTextNode(`${mess.from}: ${mess.message}`);
                message.appendChild(content);
                messages.appendChild(message);
                messageTrail[mess.time] = mess.message;
            }
        } else if (mess.type === "control") {
            let messarea;
            switch (mess.message) {
                // This will be some kind of control message for the page
                case "countDownAndStop":
                    console.log("Got countDownAndStop message");
                    messarea = document.getElementById("imessage");
                    let count = 5;
                    let itimerid = setInterval(async function () {
                        if (count > 0) {
                            messarea.style.color = "red";
                            messarea.innerHTML = `<h3>Finish Up only ${count} seconds remaining</h3>`;
                            count = count - 1;
                        } else {
                            console.log("Timer expired clean up and get ready to chat");
                            messarea.style.color = "black";
                            // hide the discussion
                            let discPanel = document.getElementById("discussion_panel");
                            console.log("voteNum is " + getVoteNum());
                            if (discPanel && getVoteNum() > 1) {
                                discPanel.style.display = "none";
                            }
                            let currAnswer = window.componentMap[currentQuestion].answer;
                            if (typeof currAnswer === "undefined") {
                                messarea.innerHTML = `<h3>You have not answered the question</h3><p>You will not be able to participate in any discussion unless you answer the question.</p>`;
                            } else {
                                if (getVoteNum() < 2) {
                                    messarea.innerHTML = `<h3>Please Give an explanation for your answer</h3><p>Then discuss your answer with your group members</p>`;
                                } else {
                                    messarea.innerHTML = `<h3>Voting for this question is complete</h3>`;
                                    let feedbackDiv = document.getElementById(`${currentQuestion}_feedback`);
                                    feedbackDiv.style.display = "none";
                                }
                            }

                            if (!eBookConfig.isInstructor) {
                                let qq = window.componentMap[currentQuestion];
                                if (getVoteNum() > 1) {
                                    qq.checkCurrentAnswer();
                                    qq.logCurrentAnswer();
                                }
                                qq.submitButton.disabled = true;
                                qq.disableInteraction();
                            }
                            clearInterval(itimerid);
                            // Get the current answer and insert it into the
                            let ansSlot = document.getElementById("first_answer");
                            const ordA = 65;
                            if (typeof currAnswer !== "undefined") {
                                currAnswer = answerToString(currAnswer);
                                ansSlot.innerHTML = currAnswer;
                            }
                            // send log message to indicate voting is over
                            if (typeof voteNum !== "undefined" && voteNum == 2) {
                                logPeerEvent({
                                    sid: eBookConfig.username,
                                    div_id: currentQuestion,
                                    event: "peer",
                                    act: "stop_question",
                                    course_name: eBookConfig.course,
                                });
                            }
                        }
                    }, 1000);
                    break;
                case "enableVote":
                    console.log("Got enableVote message");
                    window.componentMap[currentQuestion].submitButton.disabled = false;
                    window.componentMap[currentQuestion].submitButton.innerHTML =
                        "Submit";
                    window.componentMap[currentQuestion].enableInteraction();
                    if (typeof studentVoteCount !== "undefined") {
                        studentVoteCount += 1;
                        if (studentVoteCount > 2) {
                            studentVoteCount = 2;
                            console.log("WARNING: resetting studentVoteCount to 2");
                        }
                        // set a timer to check if the student hasn't voted in 10 seconds
                        // give them a warning.
                        setTimeout(() => {
                            if (studentVoteCount > 1 && !vote2done && !alertSet) {
                                alert(
                                    "You must vote twice! Even if want to keep your answer the same."
                                );
                                alertSet = true;
                            }
                        }, 10000);
                    }
                    messarea = document.getElementById("imessage");
                    messarea.innerHTML = `<h3>Time to make your 2nd vote</h3>`;
                    let feedbackDiv = document.getElementById(`${currentQuestion}_feedback`);
                    feedbackDiv.innerHTML = "";
                    feedbackDiv.className = "";
                    $(".runestone [type=radio]").prop("checked", false);
                    $(".runestone [type=checkbox]").prop("checked", false);
                    break;
                case "enableNext":
                    console.log("Got enableNext message");
                    // This moves the student to the next question in the assignment
                    // first disable the handler to prevent leaving the page.
                    $(window).off("beforeunload");
                    let nextForm = document.getElementById("nextqform");
                    nextForm.submit();
                    break;
                case "enableChat":
                    console.log(`got enableChat message with ${mess.answer}`);
                    let discPanel = document.getElementById("discussion_panel");
                    if (discPanel) {
                        discPanel.style.display = "block";
                    }
                    let peerlist = document.getElementById("peerlist");
                    const ordA = 65;
                    adict = JSON.parse(mess.answer);
                    let peersel = document.getElementById("peersel");
                    for (const key in adict) {
                        let currAnswer = adict[key];
                        let newpeer = document.createElement("p");
                        newpeer.innerHTML = `${key} answered ${currAnswer}`;
                        peerlist.appendChild(newpeer);
                        let peeropt = document.createElement("option");
                        peeropt.value = key;
                        peeropt.innerHTML = key;
                        peersel.appendChild(peeropt);
                        peersel.addEventListener("change", function () {
                            $(".ratingradio").prop("checked", false);
                        });
                    }
                    break;
                case "enableFaceChat":
                    console.log("got enableFaceChat message");
                    let facechat = document.getElementById("group_select_panel");
                    if (facechat) {
                        facechat.style.display = "block";
                    }
                default:
                    console.log("unknown control message");
            }
        }
    };

    window.onbeforeunload = function () {
        ws.onclose = function () { }; // disable onclose handler first
        ws.close();
    };
}

function getVoteNum() {
    if (typeof voteNum !== "undefined") {
        return voteNum;
    } else if (typeof studentVoteCount !== "undefined") {
        return studentVoteCount;
    } else {
        throw "Both voteNum and studentVoteCount are undefined";
    }
}

function answerToString(currAnswer) {
    const ordA = 65;
    if (currAnswer.indexOf(",") > -1) {
        let alist = currAnswer.split(",");
        let nlist = [];
        for (let x of alist) {
            nlist.push(String.fromCharCode(ordA + parseInt(x)));
        }
        currAnswer = nlist.join(",");
    } else {
        currAnswer = String.fromCharCode(ordA + parseInt(currAnswer));
    }
    console.log(`returning ${currAnswer}`);
    return currAnswer;
}

async function logPeerEvent(eventInfo) {
    // This can be refactored to take some parameters if peer grows
    // to require more logging functionality.
    console.log(`logging peer event ${eventInfo}`)
    let headers = new Headers({
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json",
    });
    let request = new Request(`${eBookConfig.new_server_prefix}/logger/bookevent`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(eventInfo),
    });
    try {
        let response = await fetch(request);
        if (!response.ok) {
            throw new Error("Failed to save the log entry");
        }
        post_return = response.json();
    } catch (e) {
        alert(`Error: Your action was not saved! The error was ${e}`);
        console.log(`Error: ${e}`);
    }
}

async function sendLtiScores(event) {
    // parse the assignment_id from the location.search
    let urlParams = new URLSearchParams(window.location.search);
    let assignmentId = urlParams.get('assignment_id');

    let data = {
        div_id: currentQuestion,
        course_name: eBookConfig.course,
        assignment_id: assignmentId,
    };
    let jsheaders = new Headers({
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json",
    });
    let request = new Request("/runestone/peer/send_lti_scores", {
        method: "POST",
        headers: jsheaders,
        body: JSON.stringify(data),
    });
    let resp = await fetch(request);
    let spec = await resp.json();
    if (spec !== "success") {
        alert(`Scores not sent! ${spec}`);
    } else {
        // success
        let butt = document.querySelector("#sendScores");
        butt.classList.replace("btn-info", "btn-secondary");
        butt.disabled = true;
    }
}


// Send a message to the websocket server
// the server can then broadcast the message or send it to a
// specific user
async function sendMessage(event) {
    var input = document.getElementById("messageText");
    //#ws.send(JSON.stringify(mess))
    let mess = {
        type: "text",
        from: `${user}`,
        message: input.value,
        time: Date.now(),
        broadcast: false,
        course_name: eBookConfig.course,
        div_id: currentQuestion,
    };
    await publishMessage(mess);
    var messages = document.getElementById("messages");
    var message = document.createElement("li");
    message.classList.add("outgoing-mess");
    var content = document.createTextNode(`${user}: ${input.value}`);
    message.appendChild(content);
    messages.appendChild(message);
    input.value = "";
    // not needed for onclick event.preventDefault()
}

function warnAndStopVote(event) {
    let mess = {
        type: "control",
        sender: `${user}`,
        message: "countDownAndStop",
        broadcast: true,
        course_name: eBookConfig.course,
    };

    publishMessage(mess);
    if (event.srcElement.id == "vote1") {
        let butt = document.querySelector("#vote1");
        butt.classList.replace("btn-info", "btn-secondary");
        document.querySelector("#makep").disabled = false;
        document.querySelector("#facechat").disabled = false;
        let ab = document.querySelector("#makeabgroups");
        if (ab) {
            ab.disabled = false;
        }
    } else {
        let butt = document.querySelector("#vote3");
        butt.classList.replace("btn-info", "btn-secondary");
        let sendScore = document.querySelector("#sendScores");
        if (sendScore) {
            sendScore.disabled = false;
        }
    }
    event.srcElement.disabled = true;
}

async function makePartners(event, is_ab) {
    // first make sure there are enough votes to make pairs
    if (answerCount < 2) {
        alert("Not enough votes to make groups");
        return;
    }
    let butt = document.querySelector("#makep");
    butt.classList.replace("btn-info", "btn-secondary");
    let gs = document.getElementById("groupsize").value;
    let data = {
        div_id: currentQuestion,
        start_time: startTime, // set in dashboard.html when loaded
        group_size: gs,
        is_ab: is_ab,
    };
    let jsheaders = new Headers({
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json",
    });
    let request = new Request("/runestone/peer/make_pairs", {
        method: "POST",
        headers: jsheaders,
        body: JSON.stringify(data),
    });
    let resp = await fetch(request);
    if (!resp.ok) {
        alert(`Pairs not made ${resp.statusText}`);
    }
    let spec = await resp.json();
    if (spec !== "success") {
        alert(`Pairs not made! ${spec}`);
    } else {
        // success
        butt.disabled = true;
        document.querySelector("#vote2").disabled = false;
    }
}

async function enableFaceChat(event) {
    let mess = {
        type: "control",
        sender: `${user}`,
        message: "enableFaceChat",
        broadcast: true,
        course_name: eBookConfig.course,
    };
    publishMessage(mess);

    let faceChatButton = document.querySelector("#facechat");
    faceChatButton.classList.replace("btn-info", "btn-secondary");
    faceChatButton.disabled = true;

    let textChatButton = document.querySelector("#makep");
    textChatButton.classList.replace("btn-info", "btn-secondary");
    textChatButton.disabled = true;

    document.querySelector("#vote2").disabled = false;
}

function startVote2(event) {
    let butt = document.querySelector("#vote2");
    butt.classList.replace("btn-info", "btn-secondary");
    event.srcElement.disabled = true;
    voteNum += 1;
    startTime2 = new Date().toUTCString();
    let mess = {
        type: "control",
        sender: `${user}`,
        message: "enableVote",
        broadcast: true,
        course_name: eBookConfig.course,
    };
    //ws.send(JSON.stringify(mess));
    publishMessage(mess);

    // Disabling the "Enable Text Chat" button (if not already done) once Vote 2 begins
    let textChatButton = document.querySelector("#makep");
    textChatButton.classList.replace("btn-info", "btn-secondary");
    textChatButton.disabled = true;
    // Disabling the "Enable in-person Chat" button (if not already done) once Vote 2 begins
    let faceChatButton = document.querySelector("#facechat");
    faceChatButton.classList.replace("btn-info", "btn-secondary");
    faceChatButton.disabled = true;

    // Enabling the "Stop Vote 2" button once Vote 2 begins
    document.querySelector("#vote3").disabled = false;
    let counterel = document.querySelector("#counter2");
    counterel.innerHTML = "<p>Vote 2 Answers: 0</p>";
}

async function clearPartners(event) {
    let butt = document.querySelector("#clearp");
    butt.classList.replace("btn-info", "btn-secondary");

    let data = {
        div_id: currentQuestion,
    };
    let jsheaders = new Headers({
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json",
    });
    let request = new Request("/runestone/peer/clear_pairs", {
        method: "POST",
        headers: jsheaders,
        body: JSON.stringify(data),
    });
    let resp = await fetch(request);
    let spec = await resp.json();
}

function enableNext() {
    let mess = {
        type: "control",
        sender: `${user}`,
        message: "enableNext",
        broadcast: true,
        course_name: eBookConfig.course,
    };
    if (typeof voteNum !== "undefined" && voteNum < 2) {
        logPeerEvent({
            sid: eBookConfig.username,
            div_id: currentQuestion,
            event: "peer",
            act: "stop_question",
            course_name: eBookConfig.course,
        });
    }
    publishMessage(mess);
    return true;
}

async function publishMessage(data) {
    let jsheaders = new Headers({
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json",
    });
    let request = new Request("/runestone/peer/publish_message", {
        method: "POST",
        headers: jsheaders,
        body: JSON.stringify(data),
    });
    let resp = await fetch(request);
    let spec = await resp.json();
}

async function ratePeer(radio) {
    let jsheaders = new Headers({
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json",
    });
    let peerToRate = document.getElementById("peersel").value;
    let eventInfo = {
        sid: eBookConfig.username,
        div_id: currentQuestion,
        event: "ratepeer",
        peer_id: peerToRate,
        course_id: eBookConfig.course,
        rating: radio.value,
    };
    let request = new Request("/runestone/peer/log_peer_rating", {
        method: "POST",
        headers: jsheaders,
        body: JSON.stringify(eventInfo),
    });
    try {
        let response = await fetch(request);
        if (!response.ok) {
            throw new Error("Failed to save the log entry");
        }
        post_return = response.json();
    } catch (e) {
        alert(`Error: Your action was not saved! The error was ${e}`);
        console.log(`Error: ${e}`);
    }
}

// This function is only for use with the async mode of peer instruction
//
async function showPeerEnableVote2() {
    // Log the justification from this student
    let mess = document.getElementById("messageText").value;

    await logPeerEvent({
        sid: eBookConfig.username,
        div_id: currentQuestion,
        event: "sendmessage",
        act: `to:system:${mess}`,
        course_name: eBookConfig.course,
    });

    // send a request to get a peer response and display it.
    let data = {
        div_id: currentQuestion,
        course: eBookConfig.course,
    };
    let jsheaders = new Headers({
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json",
    });
    let request = new Request("/runestone/peer/get_async_explainer", {
        method: "POST",
        headers: jsheaders,
        body: JSON.stringify(data),
    });
    let resp = await fetch(request);
    if (!resp.ok) {
        alert(`Error getting a justification ${resp.statusText}`);
    }
    let spec = await resp.json();
    let peerMess = spec.mess;
    let peerNameEl = document.getElementById("peerName");
    // iterate over responses
    let res = "";
    for (let response in spec.responses) {
        res += `User ${response} answered ${answerToString(
            spec.responses[response]
        )} <br />`;
    }
    //peerNameEl.innerHTML = `User ${spec.user} answered ${answerToString(spec.answer)}`;
    peerNameEl.innerHTML = res;
    let peerEl = document.getElementById("peerJust");
    peerEl.innerHTML = peerMess;
    let nextStep = document.getElementById("nextStep");
    nextStep.innerHTML =
        "Please Answer the question again.  Even if you do not wish to change your answer.  After answering click the button to go on to the next question.";
    nextStep.style.color = "red";
    let cq = document.getElementById(`${currentQuestion}_feedback`);
    cq.style.display = "none";

    $(".runestone [type=radio]").prop("checked", false);
    $(".runestone [type=checkbox]").prop("checked", false);
    studentVoteCount += 1;
    studentSubmittedVote2 = false;
    let checkme = document.querySelector(".runestone button");
    if (checkme.innerHTML === "Check Me") {
        checkme.addEventListener("click", function (event) {
            studentSubmittedVote2 = true;
            cq.style.display = "block";
        });
    }
}

async function setupPeerGroup() {
    let jsonHeaders = new Headers({
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json",
    });

    let request = new Request("/runestone/admin/course_students", {
        method: "GET",
        headers: jsonHeaders,
    });

    var studentList = {
        s1: "User 1",
        s2: "User 2",
        s3: "User 3",
        s4: "User 4",
        s5: "User 5",
    }

    try {
        let response = await fetch(request);
        if (!response.ok) {
            console.error(`Failed to get the student list for groups! ${response.statusText}`);
        } else {
            studentList = await response.json();
        }
    } catch (e) {
        console.log(`Error: ${e}`);
    }



    let select = document.getElementById("assignment_group");
    for (let [sid, name] of Object.entries(studentList)) {
        let opt = document.createElement("option");
        peerList = localStorage.getItem("peerList");
        if (!peerList) {
            peerList = "";
        }
        opt.value = sid;
        opt.innerHTML = `${studentList[sid]} (${sid})`;
        if (peerList.indexOf(sid) > -1) {
            opt.selected = true;
        }
        select.appendChild(opt);
    }
    // Make the select element searchable with multiple selections
    $('.assignment_partner_select').select2({
        placeholder: "Select up to 4 team members",
        allowClear: true,
        maximumSelectionLength: 4,
    });

}

$(function () {
    let tinput = document.getElementById("messageText");
    if (tinput) {
        tinput.addEventListener("keyup", function (event) {
            if (event.keyCode === 13) {
                event.preventDefault();
                document.getElementById("sendpeermsg").click();
            }
        });
    }
});