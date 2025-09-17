const chatDiv = document.getElementById("chat");
const inputEl = document.getElementById("msg");
const SHOW_SYSTEM = /[?&]debug=1/.test(location.search);

const messages = [
  { role: "system", content: "Peer instruction is defined as: an opportunity for peers to discuss ideas or to share answers to questions in an in-class environment, where they also have opportunities for further interactions with their instructor. You are a helpful CS2 student whos job is to faciliate peer instruction by explaining step-by-step without giving full code. Your interactions should be conversational, you do not need to include a full answer in your repsonse, just respond as a peer." }
];

function render() {
  chatDiv.innerHTML = "";
  for (const m of messages) {
    if (m.role === "system" && !SHOW_SYSTEM) continue; // hide system prompt by default
    const line = document.createElement("div");
    line.textContent = `${m.role}> ${m.content}`;
    chatDiv.appendChild(line);
  }
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function sendMessage() {
  const msg = inputEl.value.trim();
  if (!msg) return;

  messages.push({ role: "user", content: msg });
  inputEl.value = "";
  render();

  fetch("/runestone/peer/get_gpt_response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!data.ok) throw new Error(data.error || "unknown error");
      messages.push({ role: "assistant", content: data.reply });
      render();
    })
    .catch(err => {
      messages.push({ role: "assistant", content: `Error: ${err}` });
      render();
    });
}

render();