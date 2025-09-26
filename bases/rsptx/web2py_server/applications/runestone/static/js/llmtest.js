const chatDiv = document.getElementById("chat");
const inputEl = document.getElementById("msg");
const SHOW_SYSTEM = /[?&]debug=1/.test(location.search);

function readSavedContext() {
  try { return JSON.parse(localStorage.getItem('pi_context') || 'null'); } catch { return null; }
}
function saveContext(ctx) {
  try { localStorage.setItem('pi_context', JSON.stringify(ctx)); } catch {}
}
function readContextFromURL() {
  try {
    const p = new URLSearchParams(location.search);
    const v = p.get('ctx');
    if (!v) return null; 
    const json = atob(decodeURIComponent(v));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const messages = [
  { role: "system", content: "You will never give the answer, your job is to guide the student in the correct instruction. Focus on asking the student questions before giving any code. Peer instruction is defined as: an opportunity for peers to discuss ideas or to share answers to questions in an in-class environment, where they also have opportunities for further interactions with their instructor. You are a helpful CS2 student whos job is to faciliate peer instruction by explaining step-by-step without giving full code. Your interactions should be conversational, you do not need to include a full answer in the repsonse, just respond as a peer. You only engage with CS topics, if the user mentions something else bring it back to the topic." }
];



function getCurrentComponentContext(explicitComp) {
  const el = document.activeElement;
  const comp = explicitComp || (el && el.closest && el.closest('[data-component]'));
  if (!comp) return { ok:false, reason:'no focused component' };

  const id = comp.id || null;
  const type = comp.dataset.component || null;

  const clean = s => (s || '').replace(/\s+\n/g, '\n').replace(/\s{2,}/g, ' ').trim();
  const textOf = sel => clean(comp.querySelector(sel)?.innerText || '');
  const valueOf = sel => comp.querySelector(sel)?.value || '';

  const ctx = { ok:true, id, type, prompt:'', code:'', choices:[], selected:null, output:'', error:'', coach:'' };

  if (type === 'activecode') {
    const cm = comp.querySelector('.CodeMirror')?.CodeMirror;
    ctx.code = cm ? cm.getValue() : valueOf('textarea');

    ctx.prompt =
      textOf('.ac_caption, .ac_statement, .ac_question, .runestone_directive') ||
      (comp.previousElementSibling ? clean(comp.previousElementSibling.innerText) : '') ||
      clean(comp.closest('.section')?.querySelector('h1,h2,h3,h4')?.innerText || '');

    const outEl = comp.querySelector('.ac_output, .ac_output pre, .stdout, .output, pre.out, .runestone_output');
    const errEl = comp.querySelector('.ac_error, .alert-danger, .traceback, .runestone_error');

    ctx.output = clean(outEl?.innerText || '');
    ctx.error  = clean(errEl?.innerText || '');

    let coachText = '';
    const coachEl = comp.querySelector('.codecoach, .ac_codecoach, .coach, .guidance, .helptext');
    if (coachEl) {
      coachText = clean(coachEl.innerText);
    } else {
      let sib = comp.nextElementSibling;
      let steps = 0;
      while (sib && steps < 6 && coachText === '') {
        const m = sib.querySelector?.('.codecoach, .ac_codecoach, .coach, .guidance, .helptext, .alert, .panel');
        if (m) coachText = clean(m.innerText);
        sib = sib.nextElementSibling;
        steps += 1;
      }
    }
    ctx.coach = coachText;
  }
  else if (type === 'mchoice') {
    ctx.prompt = textOf('.question, .caption, .runestone_caption, .runestone') || textOf(':scope');
    ctx.choices = Array.from(comp.querySelectorAll('li, .choice, .option')).map(li => clean(li.innerText));
    const checked = comp.querySelector('input[type=radio]:checked');
    if (checked) {
      const li = checked.closest('li, .choice, .option');
      ctx.selected = li ? clean(li.innerText) : '(selected)';
    }
  }
  else if (type === 'shortanswer') {
    ctx.prompt = textOf('.question, .caption, .runestone_caption, .runestone') || textOf(':scope');
    ctx.code = valueOf('textarea, input[type=text]');
  }
  else if (type === 'parsons') {
    ctx.prompt = textOf('.question, .caption, .runestone_caption, .runestone') || textOf(':scope');
    ctx.code = Array.from(comp.querySelectorAll('.parsons-source .line')).map(n => clean(n.innerText)).join('\n');
  } else {
    ctx.prompt = textOf('.question, .caption, .runestone_caption, .runestone') || textOf(':scope');
  }

  ctx.course = window.eBookConfig?.course || null;
  ctx.basecourse = window.eBookConfig?.basecourse || null;
  ctx.username = window.eBookConfig?.username || null;

  saveContext(ctx);

  return ctx;
}

function openPeerForComponent(comp) {
  const ctx = getCurrentComponentContext(comp);
  if (!ctx || ctx.ok === false) { alert('Click inside a question first.'); return; }
  saveContext(ctx);
  const json = JSON.stringify(ctx);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const url = `/runestone/peer/llm_test?ctx=${encodeURIComponent(b64)}`;
  window.open(url, '_blank');
}

function attachPeerButtons() {
  const selector = '[data-component="activecode"], [data-component="mchoice"], [data-component="shortanswer"], [data-component="parsons"]';
  const comps = Array.from(document.querySelectorAll(selector));
  for (const comp of comps) {
    if (comp.dataset.piBtnAttached === '1') continue; // already added
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pi-ask-btn';
    btn.textContent = 'Ask a peer about this';
    btn.style.margin = '8px 0';
    btn.onclick = () => openPeerForComponent(comp);
    comp.dataset.piBtnAttached = '1';
    comp.appendChild(btn);
  }
}

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

  let ctx = getCurrentComponentContext();
  if (!ctx || ctx.ok === false) {
    ctx = readContextFromURL() || readSavedContext() || { ok:false, reason:'no context available' };
  }

  fetch("/runestone/peer/get_gpt_response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context: ctx })
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

if (chatDiv && inputEl) {
  render();
} else {
  attachPeerButtons();
}