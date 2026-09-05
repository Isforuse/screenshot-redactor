import type { Detection, RedactionKind, SampleItem, TextBox } from "./types";

const sensitiveLabels: Record<string, RedactionKind> = {
  姓名: "person_name",
  電話: "phone",
  手機: "phone",
  Email: "email",
  信箱: "email",
  地址: "address",
  身分證: "taiwan_id",
  "API Key": "api_key",
  帳號: "account"
};

const patterns: Array<{ kind: RedactionKind; regex: RegExp; score: number; reason: string }> = [
  { kind: "email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, score: 95, reason: "regex:email" },
  { kind: "phone", regex: /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/, score: 95, reason: "regex:taiwan-mobile" },
  { kind: "taiwan_id", regex: /^[A-Z][12]\d{8}$/i, score: 95, reason: "regex:taiwan-id" },
  { kind: "api_key", regex: /(sk-|api[_-]?key|secret|token|bearer)/i, score: 90, reason: "regex:secret-token" }
];

function centerY(box: TextBox["box"]) {
  return box.y + box.height / 2;
}

function sameRow(a: TextBox, b: TextBox) {
  return Math.abs(centerY(a.box) - centerY(b.box)) < 24;
}

function labelKind(box: TextBox): RedactionKind | undefined {
  const normalized = box.text.trim().toLowerCase().replace(/[：:]/g, "");
  const exact = sensitiveLabels[box.text.trim()] ?? sensitiveLabels[normalized];
  if (exact) return exact;

  if (normalized.length > 16 || /[_@./\\-]/.test(normalized)) return undefined;

  if (normalized.includes("email") || normalized.includes("mail") || normalized.includes("信箱")) return "email";
  if (normalized.includes("phone") || normalized.includes("tel") || normalized.includes("電話") || normalized.includes("手機")) return "phone";
  if (normalized.includes("name") || normalized.includes("姓名")) return "person_name";
  if (normalized.includes("address") || normalized.includes("地址")) return "address";
  if (normalized === "id" || normalized.includes("身分證")) return "taiwan_id";
  if (normalized === "api key" || normalized === "apikey" || normalized.includes("token") || normalized.includes("secret")) return "api_key";
  if (normalized.includes("account") || normalized.includes("帳號")) return "account";
  return undefined;
}

function normalizeConfusions(text: string) {
  return text.replace(/[OQ]/g, "0").replace(/[Il]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
}

function mergeBoxes(boxes: TextBox[]): TextBox["box"] {
  const left = Math.min(...boxes.map((box) => box.box.x));
  const top = Math.min(...boxes.map((box) => box.box.y));
  const right = Math.max(...boxes.map((box) => box.box.x + box.box.width));
  const bottom = Math.max(...boxes.map((box) => box.box.y + box.box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function overlapRatio(a: TextBox["box"], b: TextBox["box"]) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const intersection = width * height;
  const smallerArea = Math.min(a.width * a.height, b.width * b.height);
  return smallerArea === 0 ? 0 : intersection / smallerArea;
}

function rebuildLines(textBoxes: TextBox[]): TextBox[] {
  const sorted = [...textBoxes].sort((a, b) => centerY(a.box) - centerY(b.box) || a.box.x - b.box.x);
  const lines: TextBox[][] = [];

  for (const box of sorted) {
    const line = lines.find((items) => Math.abs(centerY(items[0].box) - centerY(box.box)) < Math.max(16, box.box.height * 0.85));
    if (line) {
      line.push(box);
    } else {
      lines.push([box]);
    }
  }

  return lines.map((line, index) => {
    const ordered = [...line].sort((a, b) => a.box.x - b.box.x);
    return {
      id: `line-${index}`,
      text: ordered.map((box) => box.text).join(" "),
      confidence: ordered.reduce((sum, box) => sum + box.confidence, 0) / ordered.length,
      box: mergeBoxes(ordered)
    };
  });
}

function contextKind(current: TextBox, all: TextBox[]): { kind: RedactionKind; reason: string; score: number } | null {
  const leftLabel = all.find(
    (candidate) =>
      candidate.id !== current.id &&
      labelKind(candidate) &&
      sameRow(candidate, current) &&
      candidate.box.x < current.box.x &&
      current.box.x - (candidate.box.x + candidate.box.width) < 90
  );

  if (leftLabel) {
    return { kind: labelKind(leftLabel)!, reason: `left-label:${leftLabel.text}`, score: 82 };
  }

  const columnHeader = all.find(
    (candidate) =>
      candidate.id !== current.id &&
      labelKind(candidate) &&
      candidate.box.y < current.box.y &&
      Math.abs(candidate.box.x - current.box.x) < 30
  );

  if (columnHeader) {
    return { kind: labelKind(columnHeader)!, reason: `column-header:${columnHeader.text}`, score: 78 };
  }

  return null;
}

function detectSingleBox(box: TextBox, textBoxes: TextBox[], allowContext = true): Detection | null {
  const reasons: string[] = [];
  let kind: RedactionKind | undefined;
  let score = 0;

  for (const pattern of patterns) {
    if (pattern.regex.test(box.text)) {
      kind = pattern.kind;
      score += pattern.score;
      reasons.push(pattern.reason);
    }
  }

  const normalized = normalizeConfusions(box.text);
  if (normalized !== box.text && /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/.test(normalized)) {
    kind = "phone";
    score += 82;
    reasons.push("uncertainty:ocr-confusion-phone");
  }

  const context = allowContext ? contextKind(box, textBoxes) : null;
  if (context) {
    kind = kind ?? context.kind;
    score += context.score;
    reasons.push(context.reason);
  }

  if (/ORD-|NT\$|登入/.test(box.text)) {
    score -= 45;
    reasons.push("negative:business-or-status-text");
  }

  if (!kind || labelKind(box)) return null;

  score += box.confidence >= 0.9 ? 8 : 0;
  score += box.confidence < 0.6 && reasons.some((reason) => reason.startsWith("left-label")) ? 15 : 0;

  return {
    textboxId: box.id,
    text: box.text,
    box: box.box,
    kind,
    score,
    reasons,
    action: score >= 80 ? "redact" : "candidate"
  };
}

export function detectTextBoxes(textBoxes: TextBox[]): Detection[] {
  const lineBoxes = rebuildLines(textBoxes);
  const allBoxes = [...textBoxes, ...lineBoxes];
  const rawDetections = allBoxes
    .map((box) => {
      const detection = detectSingleBox(box, allBoxes, !box.id.startsWith("line-"));
      if (!detection) return null;
      return {
        ...detection,
        reasons: box.id.startsWith("line-") ? ["layout:rebuilt-line", ...detection.reasons] : detection.reasons
      };
    })
    .filter((item): item is Detection => Boolean(item));

  const preciseDetections = rawDetections.filter((detection) => !detection.textboxId.startsWith("line-"));
  const filteredDetections = rawDetections.filter((detection) => {
    if (!detection.textboxId.startsWith("line-")) return true;
    return !preciseDetections.some((precise) => precise.kind === detection.kind && overlapRatio(precise.box, detection.box) > 0.5);
  });

  const byArea = new Map<string, Detection>();
  for (const detection of filteredDetections) {
    const key = `${Math.round(detection.box.x / 8)}:${Math.round(detection.box.y / 8)}:${detection.kind}`;
    const existing = byArea.get(key);
    if (!existing || detection.score > existing.score) byArea.set(key, detection);
  }

  return [...byArea.values()];
}

export function detectSensitiveText(sample: SampleItem): Detection[] {
  return detectTextBoxes(sample.textBoxes);
}

export function calculateMetrics(sample: SampleItem, detections: Detection[]) {
  const expected = new Set(sample.expectedSensitiveIds);
  const redacted = new Set(detections.filter((detection) => detection.action === "redact").map((detection) => detection.textboxId));
  const truePositive = [...redacted].filter((id) => expected.has(id)).length;
  const falsePositive = [...redacted].filter((id) => !expected.has(id)).length;
  const missed = [...expected].filter((id) => !redacted.has(id)).length;

  return {
    totalTextBoxes: sample.textBoxes.length,
    expectedSensitive: expected.size,
    detectedSensitive: redacted.size,
    truePositive,
    falsePositive,
    missed,
    recognitionSuccessRate: Math.round((sample.textBoxes.filter((box) => box.confidence >= 0.6).length / sample.textBoxes.length) * 100),
    redactionSuccessRate: Math.round((truePositive / expected.size) * 100),
    precision: redacted.size === 0 ? 0 : Math.round((truePositive / redacted.size) * 100)
  };
}
