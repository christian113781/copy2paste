// Everything Tesseract needs is bundled locally in vendor/tesseract \u2014
// no network requests, no external service, the image never leaves the
// user's machine. The worker is created lazily on first use and then
// reused for subsequent OCR requests to avoid re-paying the ~1-2s WASM
// init cost every time.
let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
      corePath: chrome.runtime.getURL("vendor/tesseract"),
      langPath: chrome.runtime.getURL("vendor/tesseract/lang-data"),
      // Blob-URL workers can run afoul of extension-page CSP; pointing
      // directly at our bundled worker script avoids that entirely.
      workerBlobURL: false,
      gzip: true,
    }).catch((err) => {
      // Let the next call retry instead of permanently caching a failure.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "C2P_OCR_IMAGE") return undefined;

  (async () => {
    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(message.dataUrl);
      sendResponse({ text: data && data.text ? data.text.trim() : "" });
    } catch (err) {
      console.error("Copy2Paste OCR error:", err);
      sendResponse({ error: err && err.message ? err.message : String(err) });
    }
  })();

  return true; // keep the message channel open for the async response
});
