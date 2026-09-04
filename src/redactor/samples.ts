import type { SampleItem } from "./types";

export const samples: SampleItem[] = [
  {
    id: "crm",
    label: "CRM 客戶資料",
    width: 920,
    height: 520,
    expectedSensitiveIds: ["name-1", "phone-1", "email-1", "address-1", "name-2", "phone-2", "email-2"],
    textBoxes: [
      { id: "title", text: "客戶列表", box: { x: 40, y: 34, width: 120, height: 30 }, confidence: 0.99 },
      { id: "h-name", text: "姓名", box: { x: 48, y: 104, width: 60, height: 24 }, confidence: 0.99 },
      { id: "h-phone", text: "電話", box: { x: 178, y: 104, width: 60, height: 24 }, confidence: 0.99 },
      { id: "h-email", text: "Email", box: { x: 338, y: 104, width: 70, height: 24 }, confidence: 0.99 },
      { id: "h-address", text: "地址", box: { x: 568, y: 104, width: 60, height: 24 }, confidence: 0.99 },
      { id: "name-1", text: "王小明", box: { x: 48, y: 164, width: 84, height: 24 }, confidence: 0.96 },
      { id: "phone-1", text: "0912-345-678", box: { x: 178, y: 164, width: 136, height: 24 }, confidence: 0.98 },
      { id: "email-1", text: "ming@example.com", box: { x: 338, y: 164, width: 178, height: 24 }, confidence: 0.98 },
      { id: "address-1", text: "台北市信義區松仁路88號", box: { x: 568, y: 164, width: 252, height: 24 }, confidence: 0.93 },
      { id: "name-2", text: "陳怡君", box: { x: 48, y: 224, width: 84, height: 24 }, confidence: 0.95 },
      { id: "phone-2", text: "O987-65I-23B", box: { x: 178, y: 224, width: 136, height: 24 }, confidence: 0.44 },
      { id: "email-2", text: "yi.jun@corp.tw", box: { x: 338, y: 224, width: 154, height: 24 }, confidence: 0.97 },
      { id: "order-1", text: "ORD-20260905", box: { x: 48, y: 322, width: 154, height: 24 }, confidence: 0.98 },
      { id: "amount-1", text: "NT$ 2,480", box: { x: 250, y: 322, width: 112, height: 24 }, confidence: 0.99 }
    ]
  },
  {
    id: "settings",
    label: "帳號設定截圖",
    width: 920,
    height: 520,
    expectedSensitiveIds: ["account", "taiwan-id", "api-key"],
    textBoxes: [
      { id: "title", text: "帳號安全設定", box: { x: 42, y: 36, width: 160, height: 30 }, confidence: 0.99 },
      { id: "label-account", text: "帳號", box: { x: 72, y: 120, width: 52, height: 24 }, confidence: 0.98 },
      { id: "account", text: "david_chen_92", box: { x: 190, y: 120, width: 154, height: 24 }, confidence: 0.96 },
      { id: "label-id", text: "身分證", box: { x: 72, y: 178, width: 72, height: 24 }, confidence: 0.99 },
      { id: "taiwan-id", text: "A123456789", box: { x: 190, y: 178, width: 126, height: 24 }, confidence: 0.97 },
      { id: "label-key", text: "API Key", box: { x: 72, y: 236, width: 82, height: 24 }, confidence: 0.99 },
      { id: "api-key", text: "DEMO_API_KEY_REDACT_ME", box: { x: 190, y: 236, width: 274, height: 24 }, confidence: 0.92 },
      { id: "login-date", text: "上次登入 2026/09/05", box: { x: 72, y: 330, width: 212, height: 24 }, confidence: 0.96 }
    ]
  }
];
