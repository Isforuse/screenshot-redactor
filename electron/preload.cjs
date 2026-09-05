const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenshotRedactor", {
  captureScreen: () => ipcRenderer.invoke("capture:screen"),
  copyImage: (dataUrl) => ipcRenderer.invoke("clipboard:write-image", dataUrl),
  recognizeImage: (dataUrl) => ipcRenderer.invoke("ocr:recognize", dataUrl),
  showPreviewWindow: () => ipcRenderer.invoke("window:preview-mode"),
  platform: process.platform
});
