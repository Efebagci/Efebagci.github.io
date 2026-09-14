// ============================================================
// Falsona
// To rename: edit GAME_NAME below, then also update the <title>
// and the two "Falsona" wordmark elements in index.html.
//
// If you host the backend elsewhere (Railway, Render, etc.),
// just update WS_URL — the rest of the code stays the same.
// ============================================================
const GAME_NAME = "Falsona";
const ROUND_SECONDS = 120;
const TURN_TIMEOUT_SECONDS = 25; // keep in sync with the backend's TURN_TIMEOUT_SECONDS
const WS_URL = "wss://api.falsona.com/ws";
const API_URL = "https://api.falsona.com";

// ---------- screen switching ----------
const screens = {
  landing: document.getElementById("screen-landing"),
  waiting: document.getElementById("screen-waiting"),
  chat: document.getElementById("screen-chat"),
  guess: document.getElementById("screen-guess"),
  result: document.getElementById("screen-result"),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

// ---------- temporary development password gate ----------
// This is unrelated to the account login system — it's just a soft,
// site-wide gate for while Falsona is still being built. The password
// itself now lives only on the server (see GATE_PASSWORD in main.py) —
// this file never sees it, and the server rejects WS connections and
// account/leaderboard requests that don't carry a valid gate_token, so
// there's nothing here for someone to read out of the page source and
// bypass with.
const GATE_TOKEN_KEY = "falsona_gate_token";
let gateToken = localStorage.getItem(GATE_TOKEN_KEY);

function unlockGateUI() {
  document.getElementById("screen-gate").classList.remove("is-active");
  document.getElementById("screen-landing").classList.add("is-active");
}

async function initGate() {
  if (!gateToken) return;
  try {
    const res = await fetch(`${API_URL}/gate/check?gate_token=${encodeURIComponent(gateToken)}`);
    if (!res.ok) throw new Error("invalid gate token");
    unlockGateUI();
  } catch {
    // stored token is stale (e.g. the backend restarted) — ask again
    gateToken = null;
    localStorage.removeItem(GATE_TOKEN_KEY);
  }
}
initGate();

document.getElementById("gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("gate-password");
  const errorEl = document.getElementById("gate-error");
  errorEl.hidden = true;

  try {
    const res = await fetch(`${API_URL}/gate/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: input.value }),
    });
    if (!res.ok) {
      errorEl.textContent = "Incorrect password.";
      errorEl.hidden = false;
      input.value = "";
      input.focus();
      return;
    }
    const data = await res.json();
    gateToken = data.gate_token;
    localStorage.setItem(GATE_TOKEN_KEY, gateToken);
    unlockGateUI();
  } catch {
    errorEl.textContent = "Couldn't reach the server — is the backend running?";
    errorEl.hidden = false;
  }
});

// ---------- game state ----------
let transcript = [];           // {from: 'me'|'partner', text: string}
let timerHandle = null;
let secondsLeft = ROUND_SECONDS;
let socket = null;
let currentPartnerType = null; // comes from the server: 'human' | 'bot'
let roundEnded = false;
let myTurn = false;            // only one side may send at a time
let partnerGuess = null;       // the partner's guess about you, if they're human ('human' | 'bot' | null)

// ---------- ranked ladder ----------
const TIERS = [
  { name: "Wood", color: "var(--tier-wood)" },
  { name: "Copper", color: "var(--tier-copper)" },
  { name: "Iron", color: "var(--tier-iron)" },
  { name: "Silver", color: "var(--tier-silver)" },
  { name: "Gold", color: "var(--tier-gold)" },
  { name: "Diamond", color: "var(--tier-diamond)" },
];
const DIVISION_LABELS = ["I", "II", "III", "IV", "V"];
const RP_PER_DIVISION = [20, 30, 45, 65, 90, 120]; // RP to fill one division, by tier
const WIN_RP = [12, 10, 9, 7, 6, 5];               // RP for a correct guess, by tier
const LOSS_RP = [-8, -10, -12, -15, -18, -22];     // RP for a wrong guess, by tier (negative)

function loadRank() {
  try {
    const saved = JSON.parse(localStorage.getItem("falsona_rank"));
    if (
      saved &&
      Number.isInteger(saved.tier) &&
      Number.isInteger(saved.division) &&
      Number.isInteger(saved.rp)
    ) {
      return saved;
    }
  } catch {}
  return { tier: 0, division: 0, rp: 0 }; // starts at Wood I
}
function saveRank(rank) {
  localStorage.setItem("falsona_rank", JSON.stringify(rank));
}

// ---------- accounts (optional — guests keep the localStorage rank above) ----------
let authToken = localStorage.getItem("falsona_token");
let authUsername = localStorage.getItem("falsona_username");
let serverRank = null; // populated once a stored token is confirmed valid

function isAuthenticated() {
  return !!authToken && !!serverRank;
}

// The rank actually shown/used right now: the account's server rank when
// logged in, otherwise the plain guest localStorage rank.
function currentRank() {
  return isAuthenticated() ? serverRank : loadRank();
}

function rankLabel(tier, division) {
  return `${TIERS[tier].name} ${DIVISION_LABELS[division]}`;
}
function rankOrder(tier, division) {
  return tier * DIVISION_LABELS.length + division;
}

// Applies a win/loss to a rank, handling promotion, demotion, and the
// Wood-I floor / Diamond-V ceiling. Returns the new rank plus the RP
// delta and whether a promotion/demotion happened. Used for guests only —
// logged-in accounts get this same formula computed by the server instead,
// so a modified client can't inflate its own rank.
function applyMatchResult(rank, won) {
  const delta = won ? WIN_RP[rank.tier] : LOSS_RP[rank.tier];
  let { tier, division, rp } = rank;
  rp += delta;

  if (delta < 0) {
    while (rp < 0) {
      if (tier === 0 && division === 0) {
        rp = 0; // can't demote below Wood I
        break;
      }
      division -= 1;
      if (division < 0) {
        tier -= 1;
        division = DIVISION_LABELS.length - 1;
      }
      rp += RP_PER_DIVISION[tier];
    }
  } else {
    while (true) {
      const atTop = tier === TIERS.length - 1 && division === DIVISION_LABELS.length - 1;
      const threshold = RP_PER_DIVISION[tier];
      if (atTop) {
        rp = Math.min(rp, threshold); // Diamond V caps out, no further promotion
        break;
      }
      if (rp < threshold) break;
      rp -= threshold;
      division += 1;
      if (division >= DIVISION_LABELS.length) {
        division = 0;
        tier += 1;
      }
    }
  }

  const after = { tier, division, rp };
  let event = null;
  if (rankOrder(after.tier, after.division) > rankOrder(rank.tier, rank.division)) {
    event = "promoted";
  } else if (rankOrder(after.tier, after.division) < rankOrder(rank.tier, rank.division)) {
    event = "demoted";
  }
  return { rank: after, delta, event };
}

function renderRankBadge() {
  const rank = currentRank();
  const tier = TIERS[rank.tier];
  const threshold = RP_PER_DIVISION[rank.tier];
  const isMax = rank.tier === TIERS.length - 1 && rank.division === DIVISION_LABELS.length - 1;

  document.getElementById("rank-badge-name").textContent = rankLabel(rank.tier, rank.division);
  document.getElementById("rank-badge-rp").textContent = isMax ? "MAX" : `${rank.rp}/${threshold} RP`;

  const badge = document.getElementById("rank-badge");
  badge.style.setProperty("--rank-color", tier.color);
  const fill = document.getElementById("rank-bar-fill");
  fill.style.setProperty("--rank-color", tier.color);
  fill.style.width = `${isMax ? 100 : Math.min(100, (rank.rp / threshold) * 100)}%`;
}

function renderAuthStatus() {
  const el = document.getElementById("auth-status");
  el.innerHTML = "";
  if (isAuthenticated()) {
    const label = document.createElement("span");
    label.textContent = `Logged in as ${authUsername}`;
    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn-text";
    logoutBtn.textContent = "Log out";
    logoutBtn.addEventListener("click", logout);
    el.append(label, logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.type = "button";
    loginBtn.className = "btn-text";
    loginBtn.textContent = "Log in";
    loginBtn.addEventListener("click", () => openAuthModal("login"));
    const signupBtn = document.createElement("button");
    signupBtn.type = "button";
    signupBtn.className = "btn-text";
    signupBtn.textContent = "Sign up";
    signupBtn.addEventListener("click", () => openAuthModal("register"));
    el.append(loginBtn, signupBtn);
  }
}

function logout() {
  authToken = null;
  authUsername = null;
  serverRank = null;
  localStorage.removeItem("falsona_token");
  localStorage.removeItem("falsona_username");
  renderAuthStatus();
  renderRankBadge();
}

async function initAuth() {
  if (!authToken) return;
  try {
    const res = await fetch(`${API_URL}/auth/me?token=${encodeURIComponent(authToken)}&gate_token=${encodeURIComponent(gateToken || "")}`);
    if (!res.ok) throw new Error("invalid session");
    const data = await res.json();
    authUsername = data.username;
    serverRank = data.rank;
  } catch {
    // stored token is no longer valid (e.g. the local database was reset) — go back to guest mode
    authToken = null;
    authUsername = null;
    localStorage.removeItem("falsona_token");
    localStorage.removeItem("falsona_username");
  }
  renderAuthStatus();
  renderRankBadge();
}

// ---------- auth modal ----------
let authMode = "login";

function openAuthModal(mode) {
  authMode = mode;
  document.getElementById("auth-modal-title").textContent = mode === "login" ? "Log in" : "Sign up";
  document.querySelector("#auth-form button[type=submit]").textContent = mode === "login" ? "Log in" : "Sign up";
  document.getElementById("auth-modal-switch").textContent =
    mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in";
  document.getElementById("auth-error").hidden = true;
  document.getElementById("auth-username").value = "";
  document.getElementById("auth-password").value = "";
  document.getElementById("auth-modal").hidden = false;
  document.getElementById("auth-username").focus();
}

function closeAuthModal() {
  document.getElementById("auth-modal").hidden = true;
}

document.getElementById("auth-modal-close").addEventListener("click", closeAuthModal);
document.getElementById("auth-modal-switch").addEventListener("click", () => {
  openAuthModal(authMode === "login" ? "register" : "login");
});

document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  const errorEl = document.getElementById("auth-error");
  errorEl.hidden = true;

  try {
    const res = await fetch(`${API_URL}/auth/${authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, gate_token: gateToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent =
        typeof data.detail === "string" ? data.detail : "Please check your username and password";
      errorEl.hidden = false;
      return;
    }
    authToken = data.token;
    authUsername = data.username;
    serverRank = data.rank;
    localStorage.setItem("falsona_token", authToken);
    localStorage.setItem("falsona_username", authUsername);
    closeAuthModal();
    renderAuthStatus();
    renderRankBadge();
  } catch {
    errorEl.textContent = "Couldn't reach the server — is the backend running?";
    errorEl.hidden = false;
  }
});

// ---------- leaderboard modal ----------
document.getElementById("btn-leaderboard").addEventListener("click", async () => {
  const modal = document.getElementById("leaderboard-modal");
  const list = document.getElementById("leaderboard-list");
  list.innerHTML = "";
  const loadingItem = document.createElement("li");
  loadingItem.textContent = "Loading…";
  list.appendChild(loadingItem);
  modal.hidden = false;

  try {
    const res = await fetch(`${API_URL}/api/leaderboard?gate_token=${encodeURIComponent(gateToken || "")}`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    list.innerHTML = "";
    if (!data.players.length) {
      const li = document.createElement("li");
      li.textContent = "No ranked players yet — be the first!";
      list.appendChild(li);
    } else {
      data.players.forEach((p) => {
        const li = document.createElement("li");
        li.textContent = `${p.username} — ${rankLabel(p.tier, p.division)} (${p.rp} RP)`;
        list.appendChild(li);
      });
    }
  } catch {
    list.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = "Couldn't reach the server.";
    list.appendChild(li);
  }
});
document.getElementById("leaderboard-modal-close").addEventListener("click", () => {
  document.getElementById("leaderboard-modal").hidden = true;
});

renderRankBadge();  // paint a guest/local rank immediately for a fast first render
renderAuthStatus();
initAuth();         // then upgrade to the account's global rank if a valid token is stored

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- chat screen ----------
const chatLog = document.getElementById("chat-log");
const guessChatLog = document.getElementById("guess-chat-log");
const resultChatLog = document.getElementById("result-chat-log");
const typingIndicator = document.getElementById("typing-indicator");
const timerEl = document.getElementById("timer");
const chatInput = document.getElementById("chat-input");
const sendButton = document.querySelector(".btn-send");
const turnTimeoutEl = document.getElementById("turn-timeout");
const turnTimeoutFill = document.getElementById("turn-timeout-fill");

function setMyTurn(value) {
  myTurn = value;
  chatInput.disabled = !value;
  sendButton.disabled = !value;
  chatInput.placeholder = value ? "type a message" : "waiting for partner…";
  typingIndicator.hidden = value; // show "partner is typing" for the whole time it's not your turn

  // reset the 25s response bar instantly, then (if it's now your turn)
  // start it shrinking toward empty over TURN_TIMEOUT_SECONDS
  turnTimeoutFill.style.transitionDuration = "0s";
  turnTimeoutFill.style.transform = "scaleX(1)";
  if (value) {
    chatInput.focus();
    turnTimeoutEl.hidden = false;
    void turnTimeoutFill.offsetWidth; // force reflow so the instant reset above takes effect first
    turnTimeoutFill.style.transitionDuration = `${TURN_TIMEOUT_SECONDS}s`;
    turnTimeoutFill.style.transform = "scaleX(0)";
  } else {
    turnTimeoutEl.hidden = true;
  }
}

function addBubble(from, text) {
  transcript.push({ from, text });
  const bubble = document.createElement("div");
  bubble.className = `bubble bubble--${from === "me" ? "me" : "partner"}`;
  bubble.textContent = text;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function addSystemNote(text) {
  const note = document.createElement("p");
  note.className = "system-note";
  note.textContent = text;
  chatLog.appendChild(note);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Renders the full conversation so far into any chat-log container —
// used for both the guess screen and the result screen, so the person
// can still read back what was said while they decide, or after.
function renderTranscriptInto(container) {
  container.innerHTML = "";
  transcript.forEach(({ from, text }) => {
    const bubble = document.createElement("div");
    bubble.className = `bubble bubble--${from === "me" ? "me" : "partner"}`;
    bubble.textContent = text;
    container.appendChild(bubble);
  });
  container.scrollTop = container.scrollHeight;
}

// ---------- WebSocket connection ----------
function connectSocket() {
  if (socket) socket.close();
  socket = new WebSocket(`${WS_URL}?gate_token=${encodeURIComponent(gateToken || "")}`);

  socket.addEventListener("message", (event) => {
    handleServerMessage(JSON.parse(event.data));
  });

  socket.addEventListener("close", () => {
    if (currentPartnerType === null && screens.waiting.classList.contains("is-active")) {
      document.querySelector(".waiting-label").textContent =
        "Couldn't reach the server — is the backend running? (see README)";
    }
  });
}

function handleServerMessage(data) {
  switch (data.type) {
    case "matched":
      currentPartnerType = data.partner_type; // 'human' | 'bot'
      showScreen("chat");
      setMyTurn(data.your_turn);
      timerHandle = setInterval(tick, 1000);
      break;
    case "message":
      addBubble("partner", data.text);
      setMyTurn(true); // partner just spoke, the turn is yours now
      break;
    case "not_your_turn":
      // client and server state drifted somehow — resync to locked
      setMyTurn(false);
      break;
    case "you_timed_out":
      handleTimeoutLoss(data.truth);
      break;
    case "partner_timed_out":
      addSystemNote("partner took too long to respond");
      endRound();
      break;
    case "partner_left":
      addSystemNote("partner disconnected");
      endRound();
      break;
    case "round_end":
      endRound();
      break;
    case "partner_guess":
      // arrives after the round ends, whenever the partner makes their
      // guess — could be before or after we make ours
      partnerGuess = data.value;
      if (screens.result.classList.contains("is-active")) {
        renderPartnerGuess();
      }
      break;
  }
}

function startRound() {
  transcript = [];
  chatLog.innerHTML = "";
  secondsLeft = ROUND_SECONDS;
  roundEnded = false;
  currentPartnerType = null;
  partnerGuess = null;
  setMyTurn(false); // locked until the "matched" message says otherwise
  updateTimerDisplay();
  showScreen("waiting");
  document.querySelector(".waiting-label").innerHTML =
    'Finding a match<span class="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>';
  connectSocket();
}

function tick() {
  secondsLeft -= 1;
  updateTimerDisplay();
  if (secondsLeft <= 0) {
    endRound();
  }
}

function updateTimerDisplay() {
  const m = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const s = String(secondsLeft % 60).padStart(2, "0");
  timerEl.textContent = `${m}:${s}`;
  timerEl.classList.toggle("is-low", secondsLeft <= 15);
}

function endRound() {
  if (roundEnded) return;
  roundEnded = true;
  clearInterval(timerHandle);
  renderTranscriptInto(guessChatLog);
  showScreen("guess");
}

document.getElementById("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!myTurn || !socket || socket.readyState !== WebSocket.OPEN) return;
  const input = chatInput;
  const text = input.value.trim();
  if (!text) return;
  addBubble("me", text);
  socket.send(JSON.stringify({ type: "message", text }));
  input.value = "";
  setMyTurn(false); // used your turn — locked until the partner replies
});

document.getElementById("btn-early-guess").addEventListener("click", endRound);
document.getElementById("btn-play").addEventListener("click", startRound);
document.getElementById("btn-again").addEventListener("click", startRound);

// ---------- guess & score ----------
function loadScore() {
  try {
    return JSON.parse(localStorage.getItem("falsona_score")) || { correct: 0, total: 0 };
  } catch {
    return { correct: 0, total: 0 };
  }
}
function saveScore(score) {
  localStorage.setItem("falsona_score", JSON.stringify(score));
}

document.querySelectorAll(".btn-guess").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const guess = btn.dataset.guess; // 'human' | 'bot'
    const truth = currentPartnerType || "bot";
    const correct = guess === truth;

    // send our guess to a human partner before the socket goes away —
    // it's what lets their result screen show what we guessed about them
    if (truth === "human" && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "guess", value: guess }));
    }

    await finishRound(correct, truth, correct ? "Correct guess" : "Wrong guess");
  });
});

async function handleTimeoutLoss(truth) {
  if (roundEnded) return;
  roundEnded = true;
  clearInterval(timerHandle);
  await finishRound(false, truth, "Timed out");
}

async function finishRound(correct, truth, verdictLabel) {
  const score = loadScore();
  score.total += 1;
  if (correct) score.correct += 1;
  saveScore(score);

  let rankBefore, rankAfter, delta, event;

  if (isAuthenticated()) {
    // logged in: the server is the source of truth for RP, so it can't be
    // tampered with client-side, and the rank is shared across devices.
    rankBefore = serverRank;
    try {
      const res = await fetch(`${API_URL}/api/report-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: authToken, correct, gate_token: gateToken }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      rankAfter = data.rank;
      delta = data.delta;
      event = data.event;
      serverRank = rankAfter;
    } catch {
      // couldn't reach the server to confirm — show a local estimate but
      // don't touch serverRank, since nothing was actually persisted
      const local = applyMatchResult(rankBefore, correct);
      rankAfter = local.rank;
      delta = local.delta;
      event = local.event;
    }
  } else {
    rankBefore = loadRank();
    const local = applyMatchResult(rankBefore, correct);
    rankAfter = local.rank;
    delta = local.delta;
    event = local.event;
    saveRank(rankAfter);
  }

  showResult(verdictLabel, truth, score, rankBefore, rankAfter, delta, event);
}

function renderPartnerGuess() {
  const el = document.getElementById("result-partner-guess");
  if (currentPartnerType !== "human") {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (partnerGuess === "human") {
    el.textContent = "They guessed you were human.";
  } else if (partnerGuess === "bot") {
    el.textContent = "They guessed you were a bot.";
  } else {
    el.textContent = "Still waiting on their guess…";
  }
}

function showResult(verdictLabel, truth, score, rankBefore, rankAfter, rankDelta, rankEvent) {
  document.getElementById("result-verdict").textContent = verdictLabel;
  document.getElementById("result-detail").textContent =
    `Your partner was ${truth === "bot" ? "a bot" : "a real human"}.`;
  renderPartnerGuess();

  const partnerLines = transcript.filter((m) => m.from === "partner");
  const quote = partnerLines.length ? pickRandom(partnerLines).text : "…";
  document.getElementById("result-quote").textContent = `"${quote}"`;
  document.getElementById("result-score").textContent =
    `Your score on this browser: ${score.correct}/${score.total}`;

  const sign = rankDelta > 0 ? "+" : "";
  document.getElementById("result-rank").textContent =
    `${rankLabel(rankAfter.tier, rankAfter.division)} · ${sign}${rankDelta} RP`;

  const eventEl = document.getElementById("result-rank-event");
  if (rankEvent === "promoted") {
    eventEl.textContent = `Promoted from ${rankLabel(rankBefore.tier, rankBefore.division)}!`;
    eventEl.hidden = false;
  } else if (rankEvent === "demoted") {
    eventEl.textContent = `Demoted from ${rankLabel(rankBefore.tier, rankBefore.division)}.`;
    eventEl.hidden = false;
  } else {
    eventEl.hidden = true;
  }

  renderTranscriptInto(resultChatLog);
  renderRankBadge(); // keep the landing badge in sync for next time
  showScreen("result");
}

// ---------- share card ----------
document.getElementById("btn-share").addEventListener("click", async () => {
  const canvas = document.getElementById("share-canvas");
  await drawTicketCanvas(canvas);

  canvas.toBlob(async (blob) => {
    const file = new File([blob], "falsona-result.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: GAME_NAME,
          text: "Human or AI? Try it yourself:",
        });
        return;
      } catch {
        // user cancelled the share, or it's unsupported — fall back to download
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "falsona-result.png";
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
});

async function drawTicketCanvas(canvas) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch {}
  }
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = "#15162B";
  ctx.fillRect(0, 0, W, H);

  const cardX = 80, cardY = 160, cardW = W - 160, cardH = H - 320;
  ctx.save();
  ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
  ctx.rotate((-1 * Math.PI) / 180);
  ctx.translate(-(cardX + cardW / 2), -(cardY + cardH / 2));

  ctx.fillStyle = "#FF4FA3";
  ctx.fillRect(cardX + 10, cardY + 10, cardW, cardH);
  ctx.fillStyle = "#F1EEE6";
  ctx.fillRect(cardX, cardY, cardW, cardH);

  ctx.fillStyle = "#15162B";
  ctx.textAlign = "center";
  ctx.font = "700 56px Fraunces, serif";
  ctx.fillText(document.getElementById("result-verdict").textContent, W / 2, cardY + 120);

  ctx.font = "32px 'Space Mono', monospace";
  ctx.fillText(document.getElementById("result-detail").textContent, W / 2, cardY + 190);

  const partnerGuessEl = document.getElementById("result-partner-guess");
  let quoteY = 280;
  if (!partnerGuessEl.hidden) {
    ctx.font = "24px 'Space Mono', monospace";
    ctx.fillText(partnerGuessEl.textContent, W / 2, cardY + 225);
    quoteY = 315; // push the quote down so it doesn't crowd this line
  }

  ctx.font = "italic 28px 'Space Mono', monospace";
  wrapText(ctx, document.getElementById("result-quote").textContent, W / 2, cardY + quoteY, cardW - 120, 38);

  ctx.font = "700 34px 'Space Mono', monospace";
  ctx.fillText(document.getElementById("result-rank").textContent, W / 2, cardY + 400);

  const eventText = document.getElementById("result-rank-event").textContent;
  if (eventText) {
    ctx.font = "italic 26px 'Space Mono', monospace";
    ctx.fillText(eventText, W / 2, cardY + 440);
  }

  ctx.font = "26px 'Space Mono', monospace";
  ctx.fillText(document.getElementById("result-score").textContent, W / 2, cardY + cardH - 90);

  ctx.fillStyle = "#FF4FA3";
  ctx.font = "700 30px 'Space Mono', monospace";
  ctx.fillText(GAME_NAME, W / 2, cardY + cardH - 40);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, curY);
      line = word + " ";
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, curY);
}
