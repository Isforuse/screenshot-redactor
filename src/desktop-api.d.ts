export {};

declare global {
  interface Window {
    screenshotRedactor?: {
      captureScreen: () => Promise<{ dataUrl: string; width: number; height: number }>;
      copyImage: (dataUrl: string) => Promise<boolean>;
      platform: string;
    };
  }
}
