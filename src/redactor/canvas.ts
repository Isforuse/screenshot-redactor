import type { Detection, SampleItem } from "./types";

export function drawSample(canvas: HTMLCanvasElement, sample: SampleItem, detections: Detection[] = [], redacted = false) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = sample.width;
  canvas.height = sample.height;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, sample.width, sample.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(26, 24, sample.width - 52, sample.height - 48);
  ctx.strokeStyle = "#cbd5e1";
  ctx.strokeRect(26, 24, sample.width - 52, sample.height - 48);
  ctx.fillStyle = "#0f172a";
  ctx.font = "20px system-ui, sans-serif";

  for (const textBox of sample.textBoxes) {
    ctx.fillStyle = textBox.id.startsWith("h-") || textBox.id.startsWith("label") ? "#334155" : "#111827";
    ctx.font = textBox.id === "title" ? "700 26px system-ui, sans-serif" : "20px system-ui, sans-serif";
    ctx.fillText(textBox.text, textBox.box.x, textBox.box.y + textBox.box.height - 4);
  }

  for (const detection of detections) {
    const pad = 5;
    const x = detection.box.x - pad;
    const y = detection.box.y - pad;
    const width = detection.box.width + pad * 2;
    const height = detection.box.height + pad * 2;

    if (redacted && detection.action === "redact") {
      ctx.fillStyle = "#111827";
      ctx.fillRect(x, y, width, height);
    } else {
      ctx.strokeStyle = detection.action === "redact" ? "#dc2626" : "#d97706";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
    }
  }
}


export async function drawImageUrl(canvas: HTMLCanvasElement, imageUrl: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const image = new Image();
  image.src = imageUrl;
  await image.decode();

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  ctx.drawImage(image, 0, 0);
}

export function drawDetectionBoxes(canvas: HTMLCanvasElement, detections: Detection[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (const detection of detections) {
    if (detection.action !== "redact") continue;
    const pad = 5;
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 4;
    ctx.strokeRect(detection.box.x - pad, detection.box.y - pad, detection.box.width + pad * 2, detection.box.height + pad * 2);
  }
}

export function redactCanvas(canvas: HTMLCanvasElement, detections: Detection[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (const detection of detections) {
    if (detection.action !== "redact") continue;
    const pad = 5;
    ctx.fillStyle = "#111827";
    ctx.fillRect(detection.box.x - pad, detection.box.y - pad, detection.box.width + pad * 2, detection.box.height + pad * 2);
  }
}
