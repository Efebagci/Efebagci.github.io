// ============================================================
// Intro page: a looping example round in the hero, and the rank
// emblems showcase. Purely decorative — no backend involved.
// ============================================================

const DEMO_ROUNDS = [
  {
    lines: [
      ["them", "hey, where you from?"],
      ["me", "canada. you?"],
      ["them", "manchester. it's raining, obviously"],
      ["me", "classic"],
      ["them", "wbu, snow already?"],
    ],
    verdict: "It was a human",
  },
  {
    lines: [
      ["me", "quick, what's 17 × 23?"],
      ["them", "lol i'm not doing maths at 11pm"],
      ["me", "suspicious"],
      ["them", "suspicious is asking strangers for homework"],
    ],
    verdict: "It was a bot",
  },
  {
    lines: [
      ["them", "ok be honest. are you a bot"],
      ["me", "that's exactly what a bot would ask"],
      ["them", "hm. fair"],
      ["me", "say something only a human would say"],
      ["them", "my cat just knocked my tea over"],
    ],
    verdict: "It was a bot",
  },
];

const demoLog = document.getElementById("demo-log");
const demoTyping = document.getElementById("demo-typing");
const demoStamp = document.getElementById("demo-stamp");
const demoTimer = document.getElementById("demo-timer");
const demoId = document.getElementById("demo-id");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function addDemoBubble(from, text) {
  const bubble = document.createElement("div");
  bubble.className = `bubble bubble--${from === "me" ? "me" : "partner"}`;
  bubble.textContent = text;
  demoLog.appendChild(bubble);
}

function showStamp(text) {
  demoStamp.textContent = text;
  demoStamp.classList.toggle("demo-stamp--human", text.includes("human"));
  demoStamp.hidden = false;
}

let secondsLeft = 112;
function tickDemoTimer() {
  secondsLeft = secondsLeft > 0 ? secondsLeft - 1 : 120;
  const m = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const s = String(secondsLeft % 60).padStart(2, "0");
  demoTimer.textContent = `${m}:${s}`;
}

async function playDemo() {
  for (let round = 0; ; round = (round + 1) % DEMO_ROUNDS.length) {
    const { lines, verdict } = DEMO_ROUNDS[round];
    demoLog.innerHTML = "";
    demoStamp.hidden = true;
    demoId.textContent = String(1000 + Math.floor(Math.random() * 9000));
    secondsLeft = 120;
    await wait(700);
    for (const [from, text] of lines) {
      if (from === "them") {
        demoTyping.hidden = false;
        await wait(900 + text.length * 25);
        demoTyping.hidden = true;
      } else {
        await wait(700 + text.length * 18);
      }
      addDemoBubble(from, text);
      await wait(450);
    }
    await wait(800);
    showStamp(verdict);
    await wait(2600);
  }
}

if (reducedMotion) {
  DEMO_ROUNDS[1].lines.forEach(([from, text]) => addDemoBubble(from, text));
  showStamp(DEMO_ROUNDS[1].verdict);
} else {
  setInterval(tickDemoTimer, 1000);
  playDemo();
}

// ---------- rank showcase ----------
const TIER_NAMES = ["Wood", "Copper", "Iron", "Silver", "Gold", "Diamond"];
document.getElementById("intro-emblems").innerHTML = TIER_NAMES.map((name, tier) =>
  `<figure class="intro-emblem" style="--i: ${tier}">${rankEmblem(tier, tier === 5 ? 4 : 0)}<figcaption>${name}</figcaption></figure>`,
).join("");
