# Screenshot Redactor MVP

Local-first MVP for screenshot personal-data redaction.

## Current Scope

This branch implements the first packaged Windows desktop workflow:

- Built-in screenshot-like samples for CRM and account settings screens
- OCR adapter boundary represented by structured text boxes and confidence values
- Sensitive-data detection with regex, label/context inference, table-column inference, and OCR confusion recovery
- Automatic black-bar redaction on canvas
- Upload entry point for manual image trials
- Electron desktop shell packaged as a Windows `.exe`
- Startup screenshot mode: opening the desktop app immediately captures the screen and shows a drag-selection overlay
- Preview-before-clipboard flow: selected screenshots are previewed first, then copied to the Windows clipboard only after confirmation
- Local OCR adapter in the Electron main process using Tesseract.js
- Usage-style Playwright test that operates the UI and exports result evidence

The current OCR adapter uses local Tesseract language data for `eng+chi_tra`. It proves the local OCR path for mixed English and Traditional Chinese screenshots, though model-quality tuning is still needed for small or low-contrast text.

## Windows Desktop Build

The MVP can be packaged as an Electron desktop app:

```bash
npm run postinstall:electron
npm run build:desktop
npm run smoke:desktop
```

The generated Windows executable is:

```text
release/win-unpacked/Screenshot Redactor.exe
```

`release/` is intentionally ignored by Git because the desktop runtime is large. Rebuild it locally from the committed source and lockfile.

Desktop behavior:

1. Open `release/win-unpacked/Screenshot Redactor.exe`.
2. The app captures the current screen and shows a full-window selection overlay.
3. Drag to select an area.
4. The selected image runs through local OCR and opens in preview.
5. Click `確認並複製圖片` to put the preview image into the Windows clipboard.

## Practical Test Evidence

The Playwright usage test opens the app, clicks the redaction action, verifies visible metrics, and captures the redacted output images.

Generated artifacts:

- `test-results/mvp-usage-report.json`
- `test-results/crm-redacted.png`
- `test-results/settings-redacted.png`

Latest local run:

- CRM sample: recognition success `93%`, redaction success `100%`, precision `100%`
- Account settings sample: recognition success `100%`, redaction success `100%`, precision `100%`

## Architecture

- `src/redactor/samples.ts`: realistic screenshot fixtures and expected sensitive fields
- `src/redactor/detector.ts`: regex, context, layout, uncertainty scoring, and metrics
- `src/redactor/canvas.ts`: sample rendering and black-bar redaction
- `electron/main.cjs`: desktop capture and clipboard IPC
- `electron/preload.cjs`: safe renderer bridge
- `src/App.tsx`: simplified user UI, screenshot overlay, preview, clipboard confirmation, and developer mode
- `scripts/package-desktop.mjs`: reproducible unpacked Windows desktop package
- `scripts/desktop-smoke.mjs`: packaged exe smoke check
- `scripts/ocr-smoke.mjs`: real Tesseract.js OCR runtime smoke check
- `tests/e2e/redactor-usage.spec.ts`: actual browser usage test and evidence export

## Isolated Environment

Development and tests use project-local dependencies from `node_modules`.

Browser usage tests run through Playwright with an isolated browser profile and write artifacts only under `test-results`.

## Commands

```bash
npm install
npm run dev
npm run build
npm run postinstall:electron
npm run build:desktop
npm run smoke:desktop
npm run smoke:ocr
npm run test
npm run test:e2e
```

On Windows PowerShell with script execution restrictions, use `npm.cmd` instead of `npm`.
