async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function startSelection(mode) {
  const tab = await getActiveTab();
  if (tab) {
    chrome.runtime.sendMessage({ type: "C2P_START_SELECTION", tabId: tab.id, mode });
  }
  window.close();
}

document.getElementById("start-text-btn").addEventListener("click", () => startSelection("text"));
document.getElementById("start-image-btn").addEventListener("click", () => startSelection("image"));

document.getElementById("pick-color-btn").addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab) {
    chrome.runtime.sendMessage({ type: "C2P_PICK_COLOR", tabId: tab.id });
  }
  window.close();
});

document.getElementById("analyze-colors-btn").addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab) {
    chrome.runtime.sendMessage({ type: "C2P_ANALYZE_COLORS", tabId: tab.id });
  }
  window.close();
});

document.getElementById("settings-btn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById("feedback-btn").addEventListener("click", async () => {
  const tab = await getActiveTab();
  const params = new URLSearchParams();
  if (tab?.url) params.set("url", tab.url);
  if (tab?.title) params.set("title", tab.title);
  chrome.tabs.create({ url: chrome.runtime.getURL(`feedback.html?${params.toString()}`) });
  window.close();
});

document.getElementById("help-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
  window.close();
});

document.getElementById("support-link").addEventListener("click", () => {
  // The <a target="_blank"> handles opening the tab natively; just close
  // the popup afterward to match the other menu items' behavior.
  window.close();
});
