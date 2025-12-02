// Configuration for the PI steps and helper functions to handle step progression in the instructor's interface
const STEP_CONFIG = {
    vote1: {
        next: ['makep', 'facechat', 'makeabgroups'],
        status: 'Vote 1 Stopped'
    },
    makep: {
        next: ['vote2'],
        status: 'Text Chat in Progress…'
    },
    facechat: {
        next: ['vote2'],
        status: 'In-person Chat in Progress…'
    },
    makeabgroups: {
        next: ['vote2'],
        status: 'A/B Experiment in Progress…'
    },
    vote2: {
        next: ['vote3'],
        status: 'Vote 2 in Progress…'
    },
    vote3: {
        next: [],
        status: 'Proceed to Next Question'
    }
};

const CHAT_MODALITIES = ['makep', 'facechat', 'makeabgroups'];
var currentStep = null;

function disableButton(btn) {
    if (btn) btn.disabled = true;
}
function enableButton(btn) {
    if (btn) btn.disabled = false;
}
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
function batchDisable(ids) {
    ids.forEach(i => {
        const b = document.getElementById(i);
        if (b) b.disabled = true;
    });
}
function batchEnable(ids) {
    ids.forEach(i => {
        const b = document.getElementById(i);
        if (b) b.disabled = false;
    });
}

function markStepComplete(btn) {
    if (!btn) return;
    const step = btn.closest('.pi-step');
    if (!step) return;
    const inner = step.querySelector('.pi-step-number-inner');
    step.classList.remove('active');
    if (inner) {
        inner.textContent = '✓';
        inner.style.backgroundColor = '#1A6A8399';
        inner.style.color = '#FFFFFF';
    }
    const group = btn.closest('.pi-step-group');
    if (group) group.classList.remove('active');
}

function markStepActive(btn) {
    if (!btn) return;
    const step = btn.closest('.pi-step');
    const group = btn.closest('.pi-step-group');
    if (step) step.classList.add('active');
    if (group) group.classList.add('active');
}

function handleButtonClick(event) {
    const id = event.target.id;
    const config = STEP_CONFIG[id];
    currentStep = id;
    if (!config) {
        // If no config, do nothing
        return;
    }

    // 1) Update the session‐status text
    setText('pi-session-status', config.status);

    // 2) Disable the clicked button
    const currentBtn = document.getElementById(id);
    disableButton(currentBtn);

    // 3) If this was a “chat modality” (makep, facechat, makeabgroups), disable all chat buttons
    if (CHAT_MODALITIES.includes(id)) {
        batchDisable(CHAT_MODALITIES);
    }

    // 4) Mark the current step as complete (✓, remove “active” outline)
    markStepComplete(currentBtn);

    // 5) Enable the next step(s) in config.next
    if (currentStep !== 'vote1') {
        batchEnable(STEP_CONFIG[currentStep].next);
    }

    // 6) Highlight (add “active” class) to the very first next step
    if (Array.isArray(config.next) && config.next.length > 0) {
        const nextBtn = document.getElementById(config.next[0]);
        markStepActive(nextBtn);
    }
}

// Function to render incoming and outgoing messages for the text chat
function renderMessage({ from, text, direction }) {
    // Create message element
    const message = document.createElement("li");
    message.classList.add(`${direction}-mess`);

    // Sender container
    const sender = document.createElement("div");
    sender.classList.add("sender");

    // Thumbnail using sender initials
    const senderInitials = document.createElement("div");
    senderInitials.classList.add("sender-initials");
    let initials = from.split(" ").map(n => n.charAt(0)).join("").toUpperCase();
    senderInitials.textContent = initials;

    // Sender name
    const senderName = document.createElement("div");
    senderName.classList.add("sender-name");
    senderName.textContent = direction === "outgoing" ? "You" : from;

    sender.appendChild(senderInitials);
    sender.appendChild(senderName);

    // Message content
    const content = document.createElement("div");
    content.classList.add("content");
    content.textContent = text;

    // Append sender and content to message
    message.appendChild(sender);
    message.appendChild(content);

    return message;
}

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
            "You have been disconnected from the peer instruction server. Will reconnect."
        );
        connect();
    };

    ws.onmessage = function (event) {
        const messages = document.getElementById("messages");
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
                let message = renderMessage({
                    from: mess.from,
                    text: mess.message,
                    direction: "incoming"
                });

                // Append message to messages container
                messages.appendChild(message);
                messages.scrollTop = messages.scrollHeight;
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
                        console.log(`count is ${count}`);
                        if (count > 0) {
                            messarea.style.color = "red";
                            messarea.innerHTML = `<h3>Finish up! Only ${count} seconds remaining.</h3>`;
                            count = count - 1;
                        } else {
                            console.log("Timer expired. Clean up and get ready to chat!");
                            voteStopped = true;
                            messarea.style.color = "black";
                            // if the student did not press the button in vote 1
                            if (!eBookConfig.isInstructor) {
                                // If the student has not voted yet, disable the submit button
                                let qq = window.componentMap[currentQuestion];
                                if (qq.didSubmit == false && qq.isAnswered == true) {
                                    qq.checkCurrentAnswer();
                                    qq.logCurrentAnswer();
                                }
                            } else {
                                // instructors only
                                if (currentStep === 'vote1') {
                                    batchEnable(STEP_CONFIG['vote1'].next);
                                }
                            }

                            // hide the discussion
                            let discPanel = document.getElementById("discussion_panel");
                            console.log("voteNum is " + getVoteNum());
                            if (discPanel && getVoteNum() > 1) {
                                console.log("Hiding discussion panel");
                                discPanel.style.display = "none";
                            }
                            let currAnswer = window.componentMap[currentQuestion].answer;
                            if (typeof currAnswer === "undefined") {
                                if (!eBookConfig.isInstructor) {
                                    messarea.innerHTML = `<h3>You have not answered the question</h3><p>You will not be able to participate in any discussion unless you answer the question.</p>`;
                                } else {
                                    messarea.innerHTML = ``;
                                }
                            } else {
                                if (getVoteNum() < 2) {
                                    messarea.innerHTML = `<h3>Please give an explanation for your answer.</h3><p>Then, discuss your answer with your group members.</p>`;
                                } else {
                                    messarea.innerHTML = `<h3>Voting for this question is complete.</h3>`;
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
                    voteStopped = false;
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
                                    "You must vote twice, even if want to keep your answer the same!"
                                );
                                alertSet = true;
                            }
                        }, 10000);
                    }
                    messarea = document.getElementById("imessage");
                    messarea.innerHTML = `<h3>Time to make your 2nd vote!</h3>`;
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
                    for (const key in adict) {
                        let currAnswer = adict[key];
                        let newpeer = document.createElement("p");
                        newpeer.innerHTML = `${key}: <strong>${currAnswer}</strong>`;
                        peerlist.appendChild(newpeer);
                    }
                    break;
                case "enableFaceChat":
                    console.log("got enableFaceChat message");
                    console.log(`group = ${mess.group}`);
                    let groupList = [];
                    if (mess.group) {
                        groupList = mess.group;
                    }
                    messarea = document.getElementById("imessage");
                    messarea.innerHTML = `<h3>Time to talk to your group</h3>
                    <ul>`;
                    for (const peer of groupList) {
                        messarea.innerHTML += `<li>${peer}</li>`;
                    }
                    messarea.innerHTML += `</ul>`;
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
    const messages = document.getElementById("messages");
    const input = document.getElementById("messageText");
    const sendButton = document.getElementById("sendpeermsg");
    const messageText = input.value.trim();

    if (messageText === "") {
        input.focus();
        return;
    }

    let mess = {
        type: "text",
        from: `${user}`,
        message: messageText,
        time: Date.now(),
        broadcast: false,
        course_name: eBookConfig.course,
        div_id: currentQuestion,
    };

    await publishMessage(mess);

    let message = renderMessage({
        from: user,
        text: messageText,
        direction: "outgoing"
    });

    // Append message to messages container
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;

    input.value = "";
    input.focus();

    // Disable the send button after sending a message
    sendButton.classList.add("disabled");
}

function warnAndStopVote(event) {
    handleButtonClick(event);

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
    } else {
        let butt = document.querySelector("#vote3");
        butt.classList.replace("btn-info", "btn-secondary");
        let sendScore = document.querySelector("#sendScores");
        if (sendScore) {
            sendScore.disabled = false;
        }
        const hideShowGraphButton = document.querySelector("#hideShowGraph");
        hideShowGraphButton.disabled = false;
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
        handleButtonClick(event);
        butt.disabled = true;
        document.querySelector("#vote2").disabled = false;
    }
}

async function enableFaceChat(event) {
    handleButtonClick(event);

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
    handleButtonClick(event);

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
        "Please answer the question again, even if you do not wish to change your answer. After answering, click the button to go on to the next question.";
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
    let sendButton = document.getElementById("sendpeermsg");

    if (tinput && sendButton) {
        tinput.addEventListener("input", function () {
            let message = this.value.trim();
            if (message !== "") {
                sendButton.classList.remove("disabled");
            } else {
                sendButton.classList.add("disabled");
            }
        });

        tinput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                let message = this.value.trim();
                if (message != "") {
                    document.getElementById("sendpeermsg").click();
                }
            }
        });
    }
});