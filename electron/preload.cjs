const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("screenshotRedactor", {
  platform: process.platform
});
