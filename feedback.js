// ============================================================
// SETUP REQUIRED: paste your Discord webhook URL below.
// Server Settings -> Integrations -> Webhooks -> New Webhook -> Copy URL.
// Until this is filled in, submissions will show a clear error instead
// of silently failing.
// ============================================================
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1524721204772995203/ggK4uZs6cMHhg4PccCq1HT-AZoLHF1vnl5lqrmRTZ_3lCcdOM0m_xx_ltZFe6_6wrAMZ";

const TYPE_META = {
  bug: { label: "\u{1F41B} Bug report", prompt: "What's the bug?", placeholder: "Be as specific as you can \u2014 what happened, and what you expected instead.", color: 15158332 },
  feature: { label: "\u2728 Feature request", prompt: "What would you like added?", placeholder: "Describe the feature and why it'd help.", color: 5793266 },
  general: { label: "\u{1F4AC} General feedback", prompt: "What's on your mind?", placeholder: "Anything you'd like to share.", color: 3901635 },
};

const form = document.getElementById("feedback-form");
const messageEl = document.getElementById("message");
const messageLabel = document.getElementById("message-label");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");

const DISCORD_PERMISSION = { origins: ["https://discord.com/*"] };

async function ensureDiscordPermission() {
  if (!chrome.permissions?.contains) return true;
  const hasPermission = await chrome.permissions.contains(DISCORD_PERMISSION);
  if (hasPermission) return true;

  try {
    return await chrome.permissions.request(DISCORD_PERMISSION);
  } catch (err) {
    console.error("Copy2Paste could not request Discord permission:", err);
    return false;
  }
}

function updateTypeUI() {
  const type = form.querySelector('input[name="type"]:checked').value;
  const meta = TYPE_META[type];
  messageLabel.textContent = meta.prompt;
  messageEl.placeholder = meta.placeholder;
}
form.querySelectorAll('input[name="type"]').forEach((el) => el.addEventListener("change", updateTypeUI));
updateTypeUI();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!DISCORD_WEBHOOK_URL) {
    setStatus("Feedback isn't wired up yet \u2014 the developer needs to add a webhook URL in feedback.js.", "error");
    return;
  }

  const type = form.querySelector('input[name="type"]:checked').value;
  const meta = TYPE_META[type];
  const message = messageEl.value.trim();
  if (!message) return;

  const hasDiscordPermission = await ensureDiscordPermission();
  if (!hasDiscordPermission) {
    setStatus("Feedback needs Discord access to send. Please allow the permission and try again.", "error");
    return;
  }

  const manifest = chrome.runtime.getManifest();

  const fields = [
    { name: "Extension version", value: manifest.version, inline: true },
    { name: "Browser", value: navigator.userAgent },
  ];

  const payload = {
    embeds: [
      {
        title: meta.label,
        description: message,
        color: meta.color,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending\u2026";
  setStatus("", "");

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Webhook responded with ${res.status}`);
    setStatus("Thanks! Your feedback was sent.", "success");
    form.reset();
    updateTypeUI();
  } catch (err) {
    console.error("Copy2Paste feedback failed:", err);
    setStatus("Couldn't send that \u2014 check your connection and try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send Feedback";
  }
});

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
}
