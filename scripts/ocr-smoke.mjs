import { createWorker } from "tesseract.js";

const worker = await createWorker("eng+chi_tra", undefined, {
  langPath: "assets/ocr",
  cachePath: "assets/ocr"
});

try {
  const result = await worker.recognize("test-results/settings-redacted.png");
  const text = result.data.text.trim();

  if (text.length === 0) {
    console.error("OCR smoke check failed. No text recognized.");
    process.exit(1);
  }

  console.log(`OCR smoke check passed. Recognized ${text.length} characters.`);
} finally {
  await worker.terminate();
}
