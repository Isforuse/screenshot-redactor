const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenshotRedactor", {
  captureScreen: () => ipcRenderer.invoke("capture:screen"),
  copyImage: (dataUrl) => ipcRenderer.invoke("clipboard:write-image", dataUrl),
  platform: process.platform
});
