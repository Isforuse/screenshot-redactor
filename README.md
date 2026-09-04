# Screenshot Redactor MVP

Local-first MVP for screenshot personal-data redaction.

## Current Scope

This branch implements the browser-based core before native Windows capture and `.exe` packaging:

- Built-in screenshot-like samples for CRM and account settings screens
- OCR adapter boundary represented by structured text boxes and confidence values
- Sensitive-data detection with regex, label/context inference, table-column inference, and OCR confusion recovery
- Automatic black-bar redaction on canvas
- Upload entry point for manual image trials
- Usage-style Playwright test that operates the UI and exports result evidence

The current MVP intentionally keeps the OCR engine replaceable. The next implementation step is to connect a real OCR adapter, then add native screenshot capture and clipboard output in an isolated desktop shell.

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
- `src/App.tsx`: MVP UI and report actions
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
npm run test
npm run test:e2e
```

On Windows PowerShell with script execution restrictions, use `npm.cmd` instead of `npm`.
