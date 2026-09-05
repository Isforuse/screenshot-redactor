import { Check, Copy, Download, Eye, FileImage, MousePointer2, ShieldCheck, TestTube2, Upload, X } from "lucide-react";
import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { drawImageUrl, drawSample, redactCanvas } from "./redactor/canvas";
import { calculateMetrics, detectSensitiveText } from "./redactor/detector";
import { samples } from "./redactor/samples";
import type { Detection, SampleItem } from "./redactor/types";

export function App() {
  const [sampleId, setSampleId] = useState(samples[0].id);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [captureImage, setCaptureImage] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [captureSelection, setCaptureSelection] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [capturedCrop, setCapturedCrop] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("桌面版啟動後會自動進入截圖模式。");
  const [detections, setDetections] = useState<Detection[]>([]);
  const [hasProcessed, setHasProcessed] = useState(false);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);

  const sample = useMemo<SampleItem>(() => samples.find((item) => item.id === sampleId) ?? samples[0], [sampleId]);
  const metrics = useMemo(() => calculateMetrics(sample, detections), [sample, detections]);

  useEffect(() => {
    if (capturedCrop) {
      if (sourceCanvasRef.current) void drawImageUrl(sourceCanvasRef.current, capturedCrop);
      if (resultCanvasRef.current) {
        void drawImageUrl(resultCanvasRef.current, capturedCrop).then(() => redactCanvas(resultCanvasRef.current!, detections));
      }
      return;
    }

    if (sourceCanvasRef.current) drawSample(sourceCanvasRef.current, sample);
    if (resultCanvasRef.current) drawSample(resultCanvasRef.current, sample, detections, hasProcessed);
  }, [sample, detections, hasProcessed, capturedCrop]);

  useEffect(() => {
    if (window.screenshotRedactor) void startDesktopCapture();
  }, []);

  function processSample() {
    const nextDetections = detectSensitiveText(sample);
    setDetections(nextDetections);
    setHasProcessed(true);
  }

  async function startDesktopCapture() {
    if (!window.screenshotRedactor) {
      setStatusMessage("目前在瀏覽器預覽模式，請使用內建樣本測試遮蔽效果。");
      return;
    }

    setStatusMessage("正在擷取螢幕，請稍候。");
    const nextCapture = await window.screenshotRedactor.captureScreen();
    setCaptureImage(nextCapture);
    setCaptureSelection(null);
    setCapturedCrop(null);
    setDetections([]);
    setHasProcessed(false);
    setStatusMessage("拖曳選取截圖範圍，放開滑鼠後進入預覽。");
  }

  async function finishSelection() {
    if (!captureImage || !captureSelection) return;
    const left = Math.min(captureSelection.startX, captureSelection.endX);
    const top = Math.min(captureSelection.startY, captureSelection.endY);
    const width = Math.abs(captureSelection.endX - captureSelection.startX);
    const height = Math.abs(captureSelection.endY - captureSelection.startY);
    if (width < 12 || height < 12) return;

    const source = new Image();
    source.src = captureImage.dataUrl;
    await source.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(source, left, top, width, height, 0, 0, width, height);

    setCapturedCrop(canvas.toDataURL("image/png"));
    setCaptureImage(null);
    setCaptureSelection(null);
    setStatusMessage("已完成截圖預覽。真 OCR 尚未接入，因此此畫面先保留人工確認後複製流程。");
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
    const canvas = resultCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    if (window.screenshotRedactor) {
      await window.screenshotRedactor.copyImage(dataUrl);
      setStatusMessage("遮蔽後圖片已寫入剪貼簿。");
      return;
    }
    await navigator.clipboard.writeText(dataUrl);
    setStatusMessage("瀏覽器模式已複製圖片 data URL。");
  }

  function resetSample(nextId: string) {
    setSampleId(nextId);
    setDetections([]);
    setHasProcessed(false);
    setUploadedImage(null);
  }

  function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadedImage(URL.createObjectURL(file));
    setDetections([]);
    setHasProcessed(false);
  }

  function downloadResult() {
    const canvas = resultCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `redacted-${sample.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function copyReport() {
    await navigator.clipboard.writeText(JSON.stringify({ sample: sample.id, metrics, detections }, null, 2));
  }

  return (
    <main className="redactor-shell">
      <section className="tool-header" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Screenshot Redactor MVP</p>
          <h1 id="app-title">截圖個資自動遮蔽</h1>
          <p className="status-text">{statusMessage}</p>
        </div>
        <div className="button-row">
          <button className="primary-button" onClick={startDesktopCapture} type="button">
            <MousePointer2 aria-hidden="true" />
            開始截圖
          </button>
          <button className="secondary-button" onClick={processSample} type="button">
            <ShieldCheck aria-hidden="true" />
            執行辨識遮蔽
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
          <button className="cancel-capture" onClick={() => setCaptureImage(null)} type="button" aria-label="取消截圖">
            <X aria-hidden="true" />
          </button>
        </section>
      ) : null}

      <section className="control-bar" aria-label="輸入控制">
        <div className="segmented">
          {samples.map((item) => (
            <button aria-pressed={sample.id === item.id} className={sample.id === item.id ? "active" : ""} key={item.id} onClick={() => resetSample(item.id)} type="button">
              {item.label}
            </button>
          ))}
        </div>
        <label className="file-button">
          <Upload aria-hidden="true" />
          上傳圖片
          <input accept="image/*" onChange={uploadImage} type="file" />
        </label>
      </section>

      <section className="workspace-grid">
        <article className="preview-panel">
          <div className="panel-title">
            <FileImage aria-hidden="true" />
            <h2>原始截圖</h2>
          </div>
          {uploadedImage ? <img alt="uploaded screenshot" src={uploadedImage} /> : <canvas ref={sourceCanvasRef} />}
        </article>

        <article className="preview-panel">
          <div className="panel-title">
            <Eye aria-hidden="true" />
            <h2>遮蔽結果</h2>
          </div>
          <canvas data-testid="result-canvas" ref={resultCanvasRef} />
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
          <span>誤遮精準率</span>
          <strong data-testid="precision-rate">{metrics.precision}%</strong>
        </article>
        <article>
          <span>成功 / 應遮</span>
          <strong>{metrics.truePositive} / {metrics.expectedSensitive}</strong>
        </article>
      </section>

      <section className="detail-panel">
        <div className="panel-title">
          <TestTube2 aria-hidden="true" />
          <h2>實際功能測試結果</h2>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={downloadResult} type="button">
            <Download aria-hidden="true" />
            下載遮蔽圖
          </button>
          <button className="primary-button" onClick={copyResultImage} type="button">
            <Check aria-hidden="true" />
            確認並複製圖片
          </button>
          <button className="ghost-button" onClick={copyReport} type="button">
            <Copy aria-hidden="true" />
            複製報告 JSON
          </button>
        </div>
        <div className="detection-list">
          {detections.length === 0 ? (
            <p className="empty-text">尚未執行。請按「執行辨識遮蔽」。</p>
          ) : (
            detections.map((detection) => (
              <article key={detection.textboxId}>
                <strong>{detection.action === "redact" ? "已遮蔽" : "候選"} · {detection.kind} · {detection.score}</strong>
                <span>{detection.text}</span>
                <small>{detection.reasons.join(" / ")}</small>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
