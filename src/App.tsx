import { Check, Copy, Download, Eye, FileImage, MousePointer2, ShieldCheck, TestTube2, Upload, X } from "lucide-react";
import { ChangeEvent, PointerEvent, useEffect, useMemo, useState } from "react";
import { cropImageDataUrl, renderMarkedImage, renderRedactedImage, sampleToImageUrl } from "./redactor/canvas";
import { calculateMetrics, detectSensitiveText, detectTextBoxes } from "./redactor/detector";
import { samples } from "./redactor/samples";
import type { Detection, SampleItem, TextBox } from "./redactor/types";

type CaptureImage = { dataUrl: string; width: number; height: number };
type Selection = { startX: number; startY: number; endX: number; endY: number };

export function App() {
  const [sampleId, setSampleId] = useState(samples[0].id);
  const [captureImage, setCaptureImage] = useState<CaptureImage | null>(null);
  const [captureSelection, setCaptureSelection] = useState<Selection | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<"capture" | "upload" | "sample" | null>(null);
  const [markedPreview, setMarkedPreview] = useState<string | null>(null);
  const [redactedPreview, setRedactedPreview] = useState<string | null>(null);
  const [ocrTextBoxes, setOcrTextBoxes] = useState<TextBox[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState("開啟後會直接擷取目前畫面，選取範圍後先預覽再複製。");
  const [detections, setDetections] = useState<Detection[]>([]);

  const sample = useMemo<SampleItem>(() => samples.find((item) => item.id === sampleId) ?? samples[0], [sampleId]);
  const metrics = useMemo(() => calculateMetrics(sample, detections), [sample, detections]);

  useEffect(() => {
    let cancelled = false;

    if (!activeImage) {
      return;
    }

    void Promise.all([renderMarkedImage(activeImage, detections), renderRedactedImage(activeImage, detections)])
      .then(([marked, redacted]) => {
        if (cancelled) return;
        setMarkedPreview(marked);
        setRedactedPreview(redacted);
      })
      .catch((error) => {
        if (cancelled) return;
        setStatusMessage(error instanceof Error ? `預覽產生失敗：${error.message}` : "預覽產生失敗。");
      });

    return () => {
      cancelled = true;
    };
  }, [activeImage, detections]);

  useEffect(() => {
    if (window.screenshotRedactor) void startDesktopCapture();
  }, []);

  function processSample() {
    const nextDetections = detectSensitiveText(sample);
    setActiveImage(sampleToImageUrl(sample));
    setActiveSource("sample");
    setOcrTextBoxes(sample.textBoxes);
    setDetections(nextDetections);
    setStatusMessage("樣本已完成辨識與遮蔽。");
  }

  async function processImage(imageUrl: string) {
    setIsProcessing(true);
    setStatusMessage("正在 OCR 辨識並判斷敏感資訊。");

    try {
      const textBoxes = window.screenshotRedactor ? await window.screenshotRedactor.recognizeImage(imageUrl) : sample.textBoxes;
      const nextDetections = detectTextBoxes(textBoxes);
      setOcrTextBoxes(textBoxes);
      setDetections(nextDetections);
      setStatusMessage(
        nextDetections.length > 0
          ? `已標示 ${nextDetections.filter((item) => item.action === "redact").length} 個將打碼區域。確認後才會寫入剪貼簿。`
          : `已完成 OCR，辨識到 ${textBoxes.length} 個文字框，未找到可自動遮蔽的敏感資訊。`
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? `OCR 失敗：${error.message}` : "OCR 失敗。");
    } finally {
      setIsProcessing(false);
    }
  }

  async function startDesktopCapture() {
    if (!window.screenshotRedactor) {
      setDeveloperMode(true);
      setStatusMessage("瀏覽器開發模式：可用樣本驗證 OCR adapter 之後的偵測與遮蔽。");
      return;
    }

    setStatusMessage("正在擷取目前畫面。");
    const nextCapture = await window.screenshotRedactor.captureScreen();
    setCaptureImage(nextCapture);
    setCaptureSelection(null);
    setActiveImage(null);
    setActiveSource(null);
    setMarkedPreview(null);
    setRedactedPreview(null);
    setOcrTextBoxes([]);
    setDetections([]);
    setStatusMessage("拖曳選取截圖範圍，放開後會進入 OCR 與預覽。");
  }

  async function finishSelection() {
    if (!captureImage || !captureSelection) return;
    const left = Math.min(captureSelection.startX, captureSelection.endX);
    const top = Math.min(captureSelection.startY, captureSelection.endY);
    const width = Math.abs(captureSelection.endX - captureSelection.startX);
    const height = Math.abs(captureSelection.endY - captureSelection.startY);
    if (width < 12 || height < 12) return;

    const crop = await cropImageDataUrl(captureImage.dataUrl, left, top, width, height);
    setActiveImage(crop);
    setActiveSource("capture");
    setCaptureImage(null);
    setCaptureSelection(null);
    await window.screenshotRedactor?.showPreviewWindow();
    await processImage(crop);
  }

  function pointerPosition(event: PointerEvent<HTMLDivElement>) {
    if (!captureImage) return { x: 0, y: 0 };
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * captureImage.width,
      y: ((event.clientY - rect.top) / rect.height) * captureImage.height
    };
  }

  async function copyResultImage() {
    if (!redactedPreview) return;
    if (window.screenshotRedactor) {
      await window.screenshotRedactor.copyImage(redactedPreview);
      setStatusMessage("遮蔽後圖片已寫入剪貼簿。");
      return;
    }
    await navigator.clipboard.writeText(redactedPreview);
    setStatusMessage("瀏覽器模式已複製圖片 data URL。");
  }

  function resetSample(nextId: string) {
    setSampleId(nextId);
    setDetections([]);
    setOcrTextBoxes([]);
    setActiveImage(null);
    setActiveSource(null);
    setMarkedPreview(null);
    setRedactedPreview(null);
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setActiveImage(imageUrl);
    setActiveSource("upload");
    setDetections([]);
    setOcrTextBoxes([]);
    await processImage(imageUrl);
  }

  function downloadResult() {
    if (!redactedPreview) return;
    const link = document.createElement("a");
    link.download = `redacted-${activeSource ?? "image"}.png`;
    link.href = redactedPreview;
    link.click();
  }

  async function copyReport() {
    await navigator.clipboard.writeText(JSON.stringify({ sample: sample.id, metrics, ocrTextBoxes, detections }, null, 2));
  }

  return (
    <main className={developerMode ? "redactor-shell developer-shell" : "redactor-shell"}>
      <section className="tool-header" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Screenshot Redactor</p>
          <h1 id="app-title">截圖去識別化</h1>
          <p className="status-text">{statusMessage}</p>
        </div>
        <div className="button-row">
          <button className="primary-button" onClick={startDesktopCapture} type="button">
            <MousePointer2 aria-hidden="true" />
            截圖
          </button>
          <button className="ghost-button" onClick={() => setDeveloperMode((value) => !value)} type="button">
            <TestTube2 aria-hidden="true" />
            {developerMode ? "一般模式" : "開發者"}
          </button>
        </div>
      </section>

      {captureImage ? (
        <section className="capture-overlay" aria-label="截圖選取">
          <div
            className="capture-stage"
            onPointerDown={(event) => {
              const point = pointerPosition(event);
              setCaptureSelection({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
              setIsSelecting(true);
            }}
            onPointerMove={(event) => {
              if (!isSelecting || !captureSelection) return;
              const point = pointerPosition(event);
              setCaptureSelection((current) => (current ? { ...current, endX: point.x, endY: point.y } : current));
            }}
            onPointerUp={() => {
              setIsSelecting(false);
              void finishSelection();
            }}
          >
            <img alt="screen capture selection" src={captureImage.dataUrl} />
            {captureSelection ? (
              <div
                className="selection-box"
                style={{
                  left: `${(Math.min(captureSelection.startX, captureSelection.endX) / captureImage.width) * 100}%`,
                  top: `${(Math.min(captureSelection.startY, captureSelection.endY) / captureImage.height) * 100}%`,
                  width: `${(Math.abs(captureSelection.endX - captureSelection.startX) / captureImage.width) * 100}%`,
                  height: `${(Math.abs(captureSelection.endY - captureSelection.startY) / captureImage.height) * 100}%`
                }}
              />
            ) : null}
          </div>
          <button className="cancel-capture" onClick={() => {
            setCaptureImage(null);
            void window.screenshotRedactor?.showPreviewWindow();
          }} type="button" aria-label="取消截圖">
            <X aria-hidden="true" />
          </button>
        </section>
      ) : null}

      {isProcessing ? <section className="processing-panel">OCR 辨識中...</section> : null}

      {developerMode ? (
        <section className="control-bar" aria-label="開發者輸入控制">
          <div className="segmented">
            {samples.map((item) => (
              <button aria-pressed={sample.id === item.id} className={sample.id === item.id ? "active" : ""} key={item.id} onClick={() => resetSample(item.id)} type="button">
                {item.label}
              </button>
            ))}
          </div>
          <button className="secondary-button" onClick={processSample} type="button">
            <ShieldCheck aria-hidden="true" />
            跑樣本
          </button>
          <label className="file-button">
            <Upload aria-hidden="true" />
            上傳圖片
            <input accept="image/*" onChange={(event) => void uploadImage(event)} type="file" />
          </label>
        </section>
      ) : null}

      <section className="user-preview">
        <article className="preview-panel">
          <div className="panel-title">
            <FileImage aria-hidden="true" />
            <h2>將打碼</h2>
          </div>
          {markedPreview ? (
            <img alt="marked redaction preview" data-testid="marked-preview" src={markedPreview} />
          ) : (
            <div className="empty-preview">尚未選取截圖範圍</div>
          )}
        </article>
        <article className="preview-panel result-panel">
          <div className="panel-title">
            <Eye aria-hidden="true" />
            <h2>完成預覽</h2>
          </div>
          {redactedPreview ? (
            <img alt="redacted screenshot preview" data-testid="result-preview" src={redactedPreview} />
          ) : (
            <div className="empty-preview">完成截圖後會顯示預覽</div>
          )}
          <div className="button-row">
            <button className="primary-button" disabled={!redactedPreview} onClick={copyResultImage} type="button">
              <Check aria-hidden="true" />
              確認並複製
            </button>
            <button className="secondary-button" disabled={!redactedPreview} onClick={downloadResult} type="button">
              <Download aria-hidden="true" />
              儲存圖片
            </button>
          </div>
        </article>
      </section>

      {developerMode ? (
        <>
          <section className="workspace-grid">
            <article className="preview-panel">
              <div className="panel-title">
                <FileImage aria-hidden="true" />
                <h2>打碼前標示</h2>
              </div>
              {markedPreview ? <img alt="developer marked screenshot" src={markedPreview} /> : <div className="empty-preview">尚未產生圖片</div>}
            </article>
            <article className="preview-panel">
              <div className="panel-title">
                <Eye aria-hidden="true" />
                <h2>遮蔽後</h2>
              </div>
              {redactedPreview ? <img alt="developer redacted screenshot" src={redactedPreview} /> : <div className="empty-preview">尚未產生圖片</div>}
            </article>
          </section>

          <section className="metrics-grid" aria-label="實測指標">
            <article>
              <span>辨識成功率</span>
              <strong data-testid="recognition-rate">{metrics.recognitionSuccessRate}%</strong>
            </article>
            <article>
              <span>遮蔽成功率</span>
              <strong data-testid="redaction-rate">{metrics.redactionSuccessRate}%</strong>
            </article>
            <article>
              <span>精準率</span>
              <strong data-testid="precision-rate">{metrics.precision}%</strong>
            </article>
            <article>
              <span>OCR 文字框</span>
              <strong>{ocrTextBoxes.length}</strong>
            </article>
          </section>

          <section className="detail-panel">
            <div className="panel-title">
              <TestTube2 aria-hidden="true" />
              <h2>開發者辨識結果</h2>
            </div>
            <div className="button-row">
              <button className="ghost-button" onClick={copyReport} type="button">
                <Copy aria-hidden="true" />
                複製 JSON
              </button>
            </div>
            <div className="detection-list">
              {ocrTextBoxes.map((box) => (
                <article key={box.id}>
                  <strong>OCR · {Math.round(box.confidence * 100)}%</strong>
                  <span>{box.text}</span>
                  <small>
                    x:{Math.round(box.box.x)} y:{Math.round(box.box.y)} w:{Math.round(box.box.width)} h:{Math.round(box.box.height)}
                  </small>
                </article>
              ))}
              {detections.map((detection) => (
                <article key={detection.textboxId}>
                  <strong>{detection.action === "redact" ? "已遮蔽" : "候選"} · {detection.kind} · {detection.score}</strong>
                  <span>{detection.text}</span>
                  <small>{detection.reasons.join(" / ")}</small>
                </article>
              ))}
              {ocrTextBoxes.length === 0 && detections.length === 0 ? <p className="empty-text">尚無 OCR 或偵測結果。</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
