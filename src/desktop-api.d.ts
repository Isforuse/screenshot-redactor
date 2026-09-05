import type { TextBox } from "./redactor/types";

export {};

declare global {
  interface Window {
    screenshotRedactor?: {
      captureScreen: () => Promise<{ dataUrl: string; width: number; height: number }>;
      copyImage: (dataUrl: string) => Promise<boolean>;
      recognizeImage: (dataUrl: string) => Promise<TextBox[]>;
      showPreviewWindow: () => Promise<boolean>;
      platform: string;
    };
  }
}
