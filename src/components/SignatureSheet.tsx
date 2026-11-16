import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  PenTool,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  getSavedSignatures,
  removeSignatureDataUrl,
  saveSignatureDataUrl,
} from '../utils/localStore';

interface SignatureSheetProps {
  open: boolean;
  onClose: () => void;
  onInsertSignature: (dataUrl: string) => void;
}

type SignatureTab = 'draw' | 'upload';

const INK_COLORS = [
  { label: 'أسود', value: '#0F172A' },
  { label: 'أزرق رسمي', value: '#1D4ED8' },
  { label: 'أحمر', value: '#DC2626' },
];

async function processUploadedSignatureImage(
  rawDataUrl: string,
  removeWhiteBg: boolean
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 900;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round((img.naturalWidth || 400) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 200) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      if (removeWhiteBg) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          // Make near-white neutral paper background transparent
          if (luminance > 205 && maxDiff < 28) {
            d[i + 3] = 0;
          } else if (luminance > 175 && maxDiff < 22) {
            d[i + 3] = Math.round(((205 - luminance) / 30) * d[i + 3]);
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export const SignatureSheet: React.FC<SignatureSheetProps> = ({
  open,
  onClose,
  onInsertSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<SignatureTab>('draw');
  const [inkColor, setInkColor] = useState('#0F172A');
  const [strokeSize, setStrokeSize] = useState(4.5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const [rawUploadedUrl, setRawUploadedUrl] = useState<string | null>(null);
  const [processedUploadedUrl, setProcessedUploadedUrl] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);

  const [savedSignatures, setSavedSignatures] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSavedSignatures(getSavedSignatures());
      setHasStrokes(false);
      setRawUploadedUrl(null);
      setProcessedUploadedUrl(null);
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      });
    }
  }, [open]);

  useEffect(() => {
    if (!rawUploadedUrl) {
      setProcessedUploadedUrl(null);
      return;
    }
    let active = true;
    processUploadedSignatureImage(rawUploadedUrl, removeBg).then((out) => {
      if (active) setProcessedUploadedUrl(out);
    });
    return () => {
      active = false;
    };
  }, [rawUploadedUrl, removeBg]);

  if (!open) return null;

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasStrokes(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const handleSaveAndUseDrawn = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;
    const dataUrl = canvas.toDataURL('image/png');
    const updated = saveSignatureDataUrl(dataUrl);
    setSavedSignatures(updated);
    onInsertSignature(dataUrl);
    onClose();
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawUploadedUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveAndUseUploaded = () => {
    if (!processedUploadedUrl) return;
    const updated = saveSignatureDataUrl(processedUploadedUrl);
    setSavedSignatures(updated);
    onInsertSignature(processedUploadedUrl);
    onClose();
  };

  const handleDeleteSaved = (sig: string) => {
    setSavedSignatures(removeSignatureDataUrl(sig));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-2xl shadow-xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-3 shrink-0" />

        <div className="px-5 py-3 md:pt-5 flex items-center justify-between border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">التوقيع الإلكتروني</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Mode Tabs: Draw vs Upload Signature Image */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('draw')}
              className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'draw'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span>رسم التوقيع</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'upload'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImagePlus className="w-4 h-4" />
              <span>رفع صورة توقيع</span>
            </button>
          </div>

          {activeTab === 'draw' ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">اللون:</span>
                  {INK_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-label={c.label}
                      onClick={() => setInkColor(c.value)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        inkColor === c.value ? 'border-slate-900 scale-110' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'رفيع', size: 3 },
                    { label: 'متوسط', size: 5 },
                    { label: 'عريض', size: 8 },
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setStrokeSize(s.size)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                        strokeSize === s.size
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative rounded-2xl border border-dashed border-slate-300 bg-slate-50 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={260}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-44 touch-none cursor-crosshair block"
                />
                {!hasStrokes && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                    ارسم توقيعك بإصبعك هنا
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>مسح</span>
                </button>
                <button
                  type="button"
                  disabled={!hasStrokes}
                  onClick={handleSaveAndUseDrawn}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ وإدراج التوقيع</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[48px] px-3 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>اختر صورة توقيع</span>
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[48px] px-3 rounded-xl border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-red-600" />
                  <span>تصوير التوقيع</span>
                </button>
              </div>

              {processedUploadedUrl ? (
                <div className="space-y-3">
                  <div className="h-36 rounded-2xl border border-slate-200 bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] flex items-center justify-center p-3">
                    <img
                      src={processedUploadedUrl}
                      alt="معاينة التوقيع المرفوع"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={removeBg}
                      onChange={(e) => setRemoveBg(e.target.checked)}
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                    <span>إزالة الخلفية البيضاء تلقائياً (توقيع شفاف)</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleSaveAndUseUploaded}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ وإدراج صورة التوقيع</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 px-4 text-center text-xs text-slate-500">
                  يمكنك رفع صورة توقيع جاهزة (PNG/JPG) أو تصوير توقيعك على ورقة بيضاء وسيتم تفريغ الخلفية تلقائياً.
                </div>
              )}
            </div>
          )}

          {savedSignatures.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                التوقيعات المحفوظة (اضغط للإدراج)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {savedSignatures.map((sig, idx) => (
                  <div
                    key={idx}
                    className="group relative rounded-xl border border-slate-200 bg-white p-2 hover:border-red-300 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onInsertSignature(sig);
                        onClose();
                      }}
                      className="w-full h-16 flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={sig}
                        alt={`توقيع محفوظ ${idx + 1}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </button>
                    <button
                      type="button"
                      aria-label="حذف التوقيع"
                      onClick={() => handleDeleteSaved(sig)}
                      className="absolute top-1 left-1 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadFile}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleUploadFile}
      />
    </div>
  );
};
