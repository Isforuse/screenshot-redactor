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
  return sensitiveLabels[box.text.trim()];
}

function normalizeConfusions(text: string) {
  return text.replace(/[OQ]/g, "0").replace(/[Il]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
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

export function detectTextBoxes(textBoxes: TextBox[]): Detection[] {
  return textBoxes
    .map((box) => {
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

      const context = contextKind(box, textBoxes);
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
      } satisfies Detection;
    })
    .filter((item): item is Detection => Boolean(item));
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
