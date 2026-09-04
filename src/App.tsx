import { Copy, Download, Eye, FileImage, ShieldCheck, TestTube2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { drawSample } from "./redactor/canvas";
import { calculateMetrics, detectSensitiveText } from "./redactor/detector";
import { samples } from "./redactor/samples";
import type { Detection, SampleItem } from "./redactor/types";

export function App() {
  const [sampleId, setSampleId] = useState(samples[0].id);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [hasProcessed, setHasProcessed] = useState(false);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);

  const sample = useMemo<SampleItem>(() => samples.find((item) => item.id === sampleId) ?? samples[0], [sampleId]);
  const metrics = useMemo(() => calculateMetrics(sample, detections), [sample, detections]);

  useEffect(() => {
    if (sourceCanvasRef.current) drawSample(sourceCanvasRef.current, sample);
    if (resultCanvasRef.current) drawSample(resultCanvasRef.current, sample, detections, hasProcessed);
  }, [sample, detections, hasProcessed]);

  function processSample() {
    const nextDetections = detectSensitiveText(sample);
    setDetections(nextDetections);
    setHasProcessed(true);
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
        </div>
        <button className="primary-button" onClick={processSample} type="button">
          <ShieldCheck aria-hidden="true" />
          執行辨識遮蔽
        </button>
      </section>

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
