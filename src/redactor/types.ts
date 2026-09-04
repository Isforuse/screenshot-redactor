export type RedactionKind = "email" | "phone" | "taiwan_id" | "address" | "person_name" | "api_key" | "account";

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextBox = {
  id: string;
  text: string;
  box: Box;
  confidence: number;
};

export type Detection = {
  textboxId: string;
  text: string;
  box: Box;
  kind: RedactionKind;
  score: number;
  reasons: string[];
  action: "redact" | "candidate";
};

export type SampleItem = {
  id: string;
  label: string;
  width: number;
  height: number;
  textBoxes: TextBox[];
  expectedSensitiveIds: string[];
};

export type ProcessMetrics = {
  totalTextBoxes: number;
  expectedSensitive: number;
  detectedSensitive: number;
  truePositive: number;
  falsePositive: number;
  missed: number;
  recognitionSuccessRate: number;
  redactionSuccessRate: number;
  precision: number;
};

export type ProcessResult = {
  detections: Detection[];
  metrics: ProcessMetrics;
};
