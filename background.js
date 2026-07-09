// Pages where content scripts can never be injected (Chrome/Edge internal
// pages, extension pages, and the web store). This is the #1 cause of
// "it didn't do anything" on first use \u2014 the freshly-opened
// chrome://extensions tab itself is one of these restricted pages.
const RESTRICTED_URL_PATTERN =
  /^(chrome|edge|about|chrome-extension|extension|moz-extension|devtools):\/\/|^https:\/\/chrome\.google\.com\/webstore|^https:\/\/chromewebstore\.google\.com/i;

const DEFAULT_TITLE =
  "Copy2Paste \u2014 click for options, or use a shortcut (default Alt+0 text / Alt+Shift+0 image)";

// content.js only *defines* window.__c2pStart the first time it's injected;
// calling it again with executeScript's `func` triggers the actual overlay,
// in the same isolated-world `window` the file already ran in.
async function startSelection(tab, mode) {
  if (!tab || !tab.id) return;

  if (!tab.url || RESTRICTED_URL_PATTERN.test(tab.url)) {
    flashWarning(tab.id, "Can't run here \u2014 open a normal webpage");
    return;
  }

  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (m) => {
        if (window.__c2pStart) window.__c2pStart(m);
      },
      args: [mode],
    });
  } catch (err) {
    console.warn("Copy2Paste couldn't start on this page:", err);
    flashWarning(tab.id, "Couldn't start \u2014 try reloading the page");
  }
}

// Puts a red "!" on the toolbar icon for a few seconds with an explanatory
// tooltip, since a page that blocks injection also blocks any in-page
// message from us \u2014 the badge is the only feedback channel left.
function flashWarning(tabId, title) {
  chrome.action.setBadgeText({ text: "!", tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#e74c3c", tabId });
  chrome.action.setTitle({ title, tabId });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "", tabId });
    chrome.action.setTitle({ title: DEFAULT_TITLE, tabId });
  }, 3500);
}

// Kept as a fallback in case default_popup ever fails to open \u2014 normally
// Chrome shows the popup instead of firing this event. Defaults to text mode.
chrome.action.onClicked.addListener((tab) => {
  startSelection(tab, "text");
});

// Keyboard shortcuts: Alt+0 (text) and Alt+Shift+0 (image) by default,
// both user-remappable via chrome://extensions/shortcuts.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-selection-text") startSelection(tab, "text");
  else if (command === "toggle-selection-image") startSelection(tab, "image");
  else if (command === "toggle-color-picker") pickColor(tab);
});

// Same injection pattern as startSelection, but calls the color-analyzer
// entry point instead \u2014 it runs once immediately, no drag needed.
async function analyzeColors(tab) {
  if (!tab || !tab.id) return;

  if (!tab.url || RESTRICTED_URL_PATTERN.test(tab.url)) {
    flashWarning(tab.id, "Can't run here \u2014 open a normal webpage");
    return;
  }

  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (window.__c2pAnalyzeColors) window.__c2pAnalyzeColors();
      },
    });
  } catch (err) {
    console.warn("Copy2Paste couldn't analyze this page:", err);
    flashWarning(tab.id, "Couldn't start \u2014 try reloading the page");
  }
}

// Same injection pattern as startSelection/analyzeColors. The click that
// actually copies the color happens inside the page itself (a real click
// event), which is what makes clipboard.writeText work reliably here \u2014
// no special single-call timing needed, unlike the old EyeDropper approach.
async function pickColor(tab) {
  if (!tab || !tab.id) return;

  if (!tab.url || RESTRICTED_URL_PATTERN.test(tab.url)) {
    flashWarning(tab.id, "Can't run here \u2014 open a normal webpage");
    return;
  }

  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (window.__c2pPickPageColor) window.__c2pPickPageColor();
      },
    });
  } catch (err) {
    console.warn("Copy2Paste couldn't start the color picker on this page:", err);
    flashWarning(tab.id, "Couldn't start \u2014 try reloading the page");
  }
}

// ---- OCR (offscreen document) ----
// Tesseract.js needs a real page context (Web Workers + WASM) that a
// Manifest V3 service worker can't provide on its own, so OCR runs inside
// a hidden "offscreen document" instead. It's created once and reused.
async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["WORKERS"],
    justification:
      "Run a local OCR engine (Tesseract.js) to read text baked into images the user selects. Everything runs on-device \u2014 no data leaves the browser.",
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // The popup's buttons can't call chrome.scripting against an arbitrary
  // tab as cleanly as the background worker can, so they send the tab id
  // and desired mode here instead.
  if (message?.type === "C2P_START_SELECTION" && message.tabId) {
    chrome.tabs.get(message.tabId, (tab) => {
      if (!chrome.runtime.lastError && tab) startSelection(tab, message.mode || "text");
    });
    return;
  }

  if (message?.type === "C2P_ANALYZE_COLORS" && message.tabId) {
    chrome.tabs.get(message.tabId, (tab) => {
      if (!chrome.runtime.lastError && tab) analyzeColors(tab);
    });
    return;
  }

  if (message?.type === "C2P_PICK_COLOR" && message.tabId) {
    chrome.tabs.get(message.tabId, (tab) => {
      if (!chrome.runtime.lastError && tab) pickColor(tab);
    });
    return;
  }

  // Text mode asks for this before sending C2P_OCR_IMAGE, so the offscreen
  // document (and its listener) is guaranteed to exist by the time the OCR
  // request itself arrives \u2014 that one goes straight to offscreen.js, not
  // through here, since chrome.runtime.sendMessage reaches every listening
  // extension context.
  if (message?.type === "C2P_ENSURE_OFFSCREEN") {
    ensureOffscreenDocument()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }

  // The content script can't screenshot the tab itself (image mode only),
  // so it asks the background worker to do it, then crops the PNG itself.
  if (message?.type === "C2P_CAPTURE_VISIBLE_TAB") {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // keep the message channel open for the async response
  }
});
