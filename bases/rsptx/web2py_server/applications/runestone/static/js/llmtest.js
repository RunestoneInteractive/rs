const chatDiv = document.getElementById("chat");
const inputEl = document.getElementById("msg");

const messages = [
  { role: "system", content: "You are a helpful CS2 student who explains step-by-step without giving full code." }
];

function render() {
  chatDiv.innerHTML = "";
  for (const m of messages) {
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