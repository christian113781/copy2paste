document.getElementById("change-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

chrome.commands.getAll((commands) => {
  const textCmd = commands.find((c) => c.name === "toggle-selection-text");
  const imageCmd = commands.find((c) => c.name === "toggle-selection-image");
  const colorCmd = commands.find((c) => c.name === "toggle-color-picker");
  document.getElementById("shortcut-text").textContent =
    textCmd && textCmd.shortcut ? textCmd.shortcut : "Not set";
  document.getElementById("shortcut-image").textContent =
    imageCmd && imageCmd.shortcut ? imageCmd.shortcut : "Not set";
  document.getElementById("shortcut-color").textContent =
    colorCmd && colorCmd.shortcut ? colorCmd.shortcut : "Not set";
});
