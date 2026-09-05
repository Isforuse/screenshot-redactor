const { BrowserWindow, app, clipboard, desktopCapturer, ipcMain, nativeImage, screen, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createWorker } = require("tesseract.js");

function writeLog(message, error) {
  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const detail = error?.stack ?? error?.message ?? String(error ?? "");
    fs.appendFileSync(path.join(logDir, "main.log"), `[${new Date().toISOString()}] ${message}\n${detail}\n`);
  } catch {
    // Logging must never become the reason the app fails.
  }
}

process.on("uncaughtException", (error) => {
  writeLog("Uncaught main process error", error);
  console.error("Uncaught main process error:", error);
});

process.on("unhandledRejection", (error) => {
  writeLog("Unhandled main process rejection", error);
  console.error("Unhandled main process rejection:", error);
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 940,
    minHeight: 680,
    title: "Screenshot Redactor",
    backgroundColor: "#eef2f6",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (app.isPackaged && !url.startsWith("file://")) {
      event.preventDefault();
    }
  });

  if (app.isPackaged) {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    window.loadURL("http://127.0.0.1:5173/");
  }
}

ipcMain.handle("capture:screen", async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) focusedWindow.hide();

  await new Promise((resolve) => setTimeout(resolve, 180));

  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: Math.round(width * display.scaleFactor), height: Math.round(height * display.scaleFactor) }
  });

  if (focusedWindow) {
    focusedWindow.setFullScreen(true);
    focusedWindow.show();
    focusedWindow.focus();
  }

  const primarySource = sources[0];
  if (!primarySource) throw new Error("No screen source available.");
  if (primarySource.thumbnail.isEmpty()) throw new Error("Screen capture returned an empty image.");

  return {
    dataUrl: primarySource.thumbnail.toDataURL(),
    width: primarySource.thumbnail.getSize().width,
    height: primarySource.thumbnail.getSize().height
  };
});

ipcMain.handle("window:preview-mode", async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!focusedWindow) return false;
  focusedWindow.setFullScreen(false);
  focusedWindow.setSize(980, 760);
  focusedWindow.center();
  focusedWindow.show();
  focusedWindow.focus();
  return true;
});

ipcMain.handle("clipboard:write-image", async (_event, dataUrl) => {
  const image = nativeImage.createFromDataURL(dataUrl);
  if (image.isEmpty()) throw new Error("Cannot write an empty image to clipboard.");
  clipboard.writeImage(image);
  return true;
});

ipcMain.handle("ocr:recognize", async (_event, dataUrl) => {
  const appRoot = app.isPackaged ? path.join(process.resourcesPath, "app") : path.join(__dirname, "..");
  let worker;

  try {
    const image = nativeImage.createFromDataURL(dataUrl);
    if (image.isEmpty()) throw new Error("OCR received an empty image.");
    const pngBuffer = image.toPNG();

    worker = await createWorker("eng+chi_tra", undefined, {
      cachePath: path.join(app.getPath("userData"), "tesseract-cache"),
      langPath: path.join(appRoot, "assets", "ocr")
    });

    const result = await worker.recognize(pngBuffer);
    const words = result.data.words ?? [];

    return words
      .filter((word) => word.text?.trim() && word.bbox)
      .map((word, index) => ({
        id: `ocr-${index}`,
        text: word.text.trim(),
        confidence: Math.max(0, Math.min(1, (word.confidence ?? 0) / 100)),
        box: {
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0
        }
      }));
  } catch (error) {
    writeLog("OCR recognition failed", error);
    throw error;
  } finally {
    if (worker) await worker.terminate();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
