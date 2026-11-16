import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  ScanText,
  Share2,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ConvertMode, OcrPageResult } from '../types/pdf';
import {
  buildSearchablePdfFromOcr,
  bundleImagesAsZip,
  downloadBlob,
  extractDocxText,
  extractTextFromPdf,
  formatBytes,
  imagesToPdf,
  pdfToImages,
  renderSinglePdfPage,
  getPdfPageCount,
  runOcrOnImageDataUrl,
  shareFileIfSupported,
  textToDocxBlob,
  textToPdfBytes,
} from '../utils/pdfEngine';

interface ConverterStudioProps {
  initialMode: ConvertMode;
  activePdf: { name: string; bytes: Uint8Array } | null;
  onSaveToHistory: (
    name: string,
    bytes: Uint8Array,
    pageCount: number,
    actionLabel: string
  ) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenPdfInEditor: (name: string, bytes: Uint8Array) => void;
}

interface ImageQueueItem {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

const MODES: Array<{ id: ConvertMode; label: string }> = [
  { id: 'img-to-pdf', label: 'صور ← PDF' },
  { id: 'ocr', label: 'التعرف الضوئي OCR' },
  { id: 'pdf-to-img', label: 'PDF ← صور' },
  { id: 'pdf-to-word', label: 'PDF ← Word' },
  { id: 'word-to-pdf', label: 'Word / نص ← PDF' },
];

export const ConverterStudio: React.FC<ConverterStudioProps> = ({
  initialMode,
  activePdf,
  onSaveToHistory,
  onNotify,
  onOpenPdfInEditor,
}) => {
  const [mode, setMode] = useState<ConvertMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Images -> PDF state
  const [imgQueue, setImgQueue] = useState<ImageQueueItem[]>([]);
  const [pageSize, setPageSize] = useState<'a4' | 'fit'>('a4');
  const [margin, setMargin] = useState<number>(24);
  const [imgPdfResult, setImgPdfResult] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);

  // PDF -> Images state
  const [localPdf, setLocalPdf] = useState<{ name: string; bytes: Uint8Array } | null>(
    activePdf
  );
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png');
  const [exportedImages, setExportedImages] = useState<
    Array<{ pageNumber: number; dataUrl: string; blob: Blob }>
  >([]);

  // PDF -> Word / Text state
  const [extractedPages, setExtractedPages] = useState<
    Array<{ pageNumber: number; text: string }>
  >([]);
  const [editableText, setEditableText] = useState('');

  // Word / Text -> PDF state
  const [docTitle, setDocTitle] = useState('');
  const [docText, setDocText] = useState('');
  const [textPdfResult, setTextPdfResult] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);

  // OCR state
  const [ocrSource, setOcrSource] = useState<
    | { kind: 'pdf'; name: string; bytes: Uint8Array; pageCount: number }
    | { kind: 'images'; name: string; images: ImageQueueItem[] }
    | null
  >(
    activePdf
      ? { kind: 'pdf', name: activePdf.name, bytes: activePdf.bytes, pageCount: 1 }
      : null
  );
  const [ocrLang, setOcrLang] = useState<'auto' | 'ar' | 'en'>('auto');
  const [ocrResults, setOcrResults] = useState<OcrPageResult[]>([]);
  const [ocrCombinedText, setOcrCombinedText] = useState('');
  const [searchablePdf, setSearchablePdf] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);

  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const wordInputRef = useRef<HTMLInputElement | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement | null>(null);
  const ocrCameraInputRef = useRef<HTMLInputElement | null>(null);

  const currentPdf = localPdf || activePdf;

  const readFileAsDataUrl = (file: File): Promise<ImageQueueItem> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () =>
          resolve({
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            dataUrl,
            width: img.naturalWidth || 1000,
            height: img.naturalHeight || 1000,
          });
        img.onerror = () => reject(new Error('تعذر قراءة الصورة'));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error('تعذر فتح الملف'));
      reader.readAsDataURL(file);
    });

  const handleAddImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const loaded = await Promise.all(Array.from(files).map(readFileAsDataUrl));
      setImgQueue((prev) => [...prev, ...loaded]);
      setImgPdfResult(null);
    } catch {
      onNotify('error', 'تعذر قراءة إحدى الصور المختارة.');
    }
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImgQueue((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const handleConvertImagesToPdf = async () => {
    if (imgQueue.length === 0) return;
    setBusy(true);
    setProgressMsg('جاري تحويل الصور إلى PDF...');
    try {
      const bytes = await imagesToPdf(imgQueue, { pageSize, margin });
      const fileName = `صور_مجمعة_${Date.now().toString().slice(-4)}.pdf`;
      setImgPdfResult({ name: fileName, bytes });
      await onSaveToHistory(fileName, bytes, imgQueue.length, 'تحويل من صور');
      onNotify('success', 'تم تحويل الصور إلى ملف PDF بنجاح.');
    } catch {
      onNotify('error', 'حدث خطأ أثناء إنشاء ملف PDF.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handlePickPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    setLocalPdf({ name: file.name, bytes });
    setExportedImages([]);
    setExtractedPages([]);
    setEditableText('');
    e.target.value = '';
  };

  const handlePdfToImages = async () => {
    if (!currentPdf) return;
    setBusy(true);
    setProgressMsg('جاري تصدير صفحات PDF كصور...');
    try {
      const imgs = await pdfToImages(currentPdf.bytes, imgFormat, 2);
      setExportedImages(imgs);
      onNotify('success', `تم تحويل ${imgs.length} صفحات إلى صور.`);
    } catch {
      onNotify('error', 'تعذر تحويل الملف إلى صور.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handleDownloadImagesZip = async () => {
    if (!currentPdf || exportedImages.length === 0) return;
    const zipBlob = await bundleImagesAsZip(exportedImages, imgFormat, currentPdf.name);
    const zipName = `${currentPdf.name.replace(/\.pdf$/i, '')}_images.zip`;
    downloadBlob(zipBlob, zipName);
  };

  const handleExtractDigitalText = async () => {
    if (!currentPdf) return;
    setBusy(true);
    setProgressMsg('جاري استخراج النصوص...');
    try {
      const pages = await extractTextFromPdf(currentPdf.bytes);
      setExtractedPages(pages);
      const joined = pages.map((p) => p.text).filter(Boolean).join('\n\n');
      setEditableText(joined);
      if (!joined.trim()) {
        onNotify(
          'info',
          'هذا الملف يبدو ممسوحاً ضوئياً كصور. استخدم تبويب التعرف الضوئي OCR لقراءته.'
        );
      } else {
        onNotify('success', 'تم استخراج النصوص بنجاح.');
      }
    } catch {
      onNotify('error', 'تعذر استخراج النصوص من هذا الملف.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handleDownloadWordFromText = async (textContent: string, baseName: string) => {
    const paragraphs = textContent.split(/\n{2,}/).map((t, i) => ({
      pageNumber: i + 1,
      text: t,
    }));
    const blob = await textToDocxBlob(
      paragraphs.length > 0 ? paragraphs : [{ pageNumber: 1, text: textContent }],
      baseName
    );
    downloadBlob(blob, `${baseName}.docx`);
    onNotify('success', 'تم تنزيل ملف Word (.docx).');
  };

  const handleUploadWordOrText = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setProgressMsg('جاري قراءة المستند...');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'docx') {
        const text = await extractDocxText(await file.arrayBuffer());
        setDocText(text);
        setDocTitle(file.name.replace(/\.docx$/i, ''));
      } else {
        const text = await file.text();
        setDocText(text);
        setDocTitle(file.name.replace(/\.(txt|md)$/i, ''));
      }
      setTextPdfResult(null);
      onNotify('success', 'تم استيراد محتوى المستند.');
    } catch {
      onNotify('error', 'تعذر قراءة الملف. تأكد من أنه بصيغة DOCX أو TXT.');
    } finally {
      setBusy(false);
      setProgressMsg('');
      e.target.value = '';
    }
  };

  const handleBuildPdfFromText = async () => {
    if (!docText.trim()) {
      onNotify('info', 'أدخل نصاً أو ارفع ملف Word أولاً.');
      return;
    }
    setBusy(true);
    setProgressMsg('جاري إنشاء ملف PDF...');
    try {
      const bytes = await textToPdfBytes(docText, docTitle);
      const count = await getPdfPageCount(bytes);
      const name = `${docTitle.trim() || 'مستند_محول'}.pdf`;
      setTextPdfResult({ name, bytes });
      await onSaveToHistory(name, bytes, count, 'تحويل من نص/Word');
      onNotify('success', 'تم إنشاء ملف PDF بنجاح.');
    } catch {
      onNotify('error', 'حدث خطأ أثناء إنشاء ملف PDF.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  // OCR handlers
  const handleSelectOcrFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setOcrResults([]);
    setOcrCombinedText('');
    setSearchablePdf(null);

    const first = files[0];
    if (first.type === 'application/pdf' || first.name.toLowerCase().endsWith('.pdf')) {
      const bytes = new Uint8Array(await first.arrayBuffer());
      const pageCount = await getPdfPageCount(bytes);
      setOcrSource({ kind: 'pdf', name: first.name, bytes, pageCount });
    } else {
      const imgs = await Promise.all(Array.from(files).map(readFileAsDataUrl));
      setOcrSource({
        kind: 'images',
        name: imgs.length === 1 ? imgs[0].name : `${imgs.length}_صور_ممسوحة`,
        images: imgs,
      });
    }
  };

  const handleRunOcr = async () => {
    const src =
      ocrSource ||
      (currentPdf
        ? {
            kind: 'pdf' as const,
            name: currentPdf.name,
            bytes: currentPdf.bytes,
            pageCount: 0,
          }
        : null);
    if (!src) return;

    setBusy(true);
    setOcrResults([]);
    setSearchablePdf(null);

    try {
      const results: OcrPageResult[] = [];
      if (src.kind === 'images') {
        for (let i = 0; i < src.images.length; i++) {
          setProgressMsg(`التعرف الضوئي على الصورة ${i + 1} من ${src.images.length}...`);
          const res = await runOcrOnImageDataUrl(src.images[i].dataUrl, ocrLang);
          results.push({
            pageNumber: i + 1,
            fullText: res.fullText,
            detectedLanguage: res.detectedLanguage,
            lines: res.lines,
          });
        }
      } else {
        const total = src.pageCount || (await getPdfPageCount(src.bytes));
        const limit = Math.min(total, 10);
        for (let i = 0; i < limit; i++) {
          setProgressMsg(`قراءة الصفحة ${i + 1} من ${limit} بالذكاء البصري...`);
          const rendered = await renderSinglePdfPage(src.bytes, i, 1.8, 0);
          const res = await runOcrOnImageDataUrl(rendered.dataUrl, ocrLang);
          results.push({
            pageNumber: i + 1,
            fullText: res.fullText,
            detectedLanguage: res.detectedLanguage,
            lines: res.lines,
          });
        }
        if (total > limit) {
          onNotify('info', `تمت معالجة أول ${limit} صفحات لضمان سرعة الاستجابة عبر الهاتف.`);
        }
      }

      setOcrResults(results);
      setOcrCombinedText(
        results
          .map((r) => r.fullText)
          .filter(Boolean)
          .join('\n\n')
      );
      onNotify('success', 'تم استخراج النص بنجاح! يمكنك تعديله أو إنشاء PDF قابل للبحث.');
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر إتمام التعرف الضوئي على النص.'
      );
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handleCreateSearchablePdf = async () => {
    const src =
      ocrSource ||
      (currentPdf
        ? { kind: 'pdf' as const, name: currentPdf.name, bytes: currentPdf.bytes, pageCount: 1 }
        : null);
    if (!src || ocrResults.length === 0) return;

    setBusy(true);
    setProgressMsg('جاري دمج طبقة النص القابلة للبحث داخل PDF...');
    try {
      const syncedResults = ocrResults.map((r, idx) =>
        ocrResults.length === 1 && idx === 0
          ? { ...r, fullText: ocrCombinedText }
          : r
      );

      const bytes = await buildSearchablePdfFromOcr(
        src.kind === 'pdf'
          ? { kind: 'pdf', bytes: src.bytes }
          : { kind: 'images', images: src.images },
        syncedResults
      );
      const count = await getPdfPageCount(bytes);
      const base = src.name.replace(/\.(pdf|png|jpg|jpeg|webp)$/i, '');
      const outName = `${base}_قابل_للبحث.pdf`;
      setSearchablePdf({ name: outName, bytes });
      await onSaveToHistory(outName, bytes, count, 'OCR قابل للبحث');
      onNotify('success', 'تم إنشاء ملف PDF قابل للبحث والنسخ بنجاح.');
    } catch {
      onNotify('error', 'حدث خطأ أثناء بناء ملف PDF القابل للبحث.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 pb-24 md:pb-12 space-y-6">
      {/* Mode Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl overflow-x-auto no-scrollbar">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs md:text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              mode === m.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {busy && (
        <div className="rounded-2xl bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between text-sm">
          <span>{progressMsg || 'جاري المعالجة...'}</span>
          <span className="text-xs text-slate-300">يرجى الانتظار</span>
        </div>
      )}

      {/* MODE 1: Images -> PDF */}
      {mode === 'img-to-pdf' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">تحويل الصور إلى ملف PDF</h2>
                <p className="text-sm text-slate-500">
                  التقط صوراً بالكاميرا أو اختر من معرض الهاتف ورتبها بسهولة
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs md:text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-red-600" />
                  <span>الكاميرا</span>
                </button>
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-medium hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>إضافة صور</span>
                </button>
              </div>
            </div>

            {imgQueue.length === 0 ? (
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                className="w-full py-14 rounded-2xl border-2 border-dashed border-slate-200 hover:border-red-300 bg-slate-50/70 flex flex-col items-center justify-center gap-2 text-slate-600 cursor-pointer transition-colors"
              >
                <Upload className="w-7 h-7 text-red-600" />
                <span className="text-sm font-semibold text-slate-800">
                  اضغط لاختيار الصور من جهازك
                </span>
                <span className="text-xs text-slate-500">PNG · JPG · WEBP</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imgQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2 flex flex-col gap-2"
                  >
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-white border border-slate-100">
                      <img
                        src={item.dataUrl}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono-num text-slate-600">
                        صفحة {idx + 1}
                      </span>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => moveImage(idx, -1)}
                          disabled={idx === 0}
                          aria-label="تقديم"
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(idx, 1)}
                          disabled={idx === imgQueue.length - 1}
                          aria-label="تأخير"
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setImgQueue((q) => q.filter((x) => x.id !== item.id))
                          }
                          aria-label="حذف الصورة"
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <h3 className="text-base font-bold text-slate-900">إعدادات الصفحة</h3>

            <div>
              <span className="block text-xs font-medium text-slate-600 mb-2">مقاس الصفحة</span>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPageSize('a4')}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                    pageSize === 'a4' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  A4 قياسي
                </button>
                <button
                  type="button"
                  onClick={() => setPageSize('fit')}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                    pageSize === 'fit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  مقاس الصورة
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-600 mb-2">الهوامش</span>
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                {[
                  { val: 0, label: 'بدون' },
                  { val: 24, label: 'عادي' },
                  { val: 48, label: 'واسع' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setMargin(opt.val)}
                    className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                      margin === opt.val
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={imgQueue.length === 0 || busy}
              onClick={handleConvertImagesToPdf}
              className="w-full min-h-[48px] rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 cursor-pointer"
            >
              إنشاء ملف PDF ({imgQueue.length})
            </button>

            {imgPdfResult && (
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <p className="text-xs text-slate-600 font-mono-num">
                  جاهز · {formatBytes(imgPdfResult.bytes.byteLength)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadBlob(
                        new Blob([imgPdfResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                        imgPdfResult.name
                      )
                    }
                    className="min-h-[44px] rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      shareFileIfSupported(
                        new Blob([imgPdfResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                        imgPdfResult.name
                      ).then((ok) => {
                        if (!ok) {
                          downloadBlob(
                            new Blob([imgPdfResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                            imgPdfResult.name
                          );
                        }
                      })
                    }
                    className="min-h-[44px] rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>مشاركة</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPdfInEditor(imgPdfResult.name, imgPdfResult.bytes)
                  }
                  className="w-full min-h-[42px] rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  فتح الملف في المحرر
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: OCR (Images & Scanned PDFs -> Editable & Searchable) */}
      {mode === 'ocr' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                التعرف الضوئي على النص (OCR)
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                استخرج النصوص العربية والإنجليزية من الصور أو ملفات PDF الممسوحة ضوئياً وحوّلها إلى مستند قابل للبحث والتحرير.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => ocrCameraInputRef.current?.click()}
                className="min-h-[48px] px-3 rounded-xl border border-slate-200 text-slate-800 text-xs md:text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-red-600" />
                <span>تصوير صفحة</span>
              </button>
              <button
                type="button"
                onClick={() => ocrFileInputRef.current?.click()}
                className="min-h-[48px] px-3 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>صورة أو PDF</span>
              </button>
            </div>

            {(ocrSource || currentPdf) && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {ocrSource ? ocrSource.name : currentPdf?.name}
                </p>
                <p className="text-xs text-slate-500 font-mono-num">
                  {ocrSource
                    ? ocrSource.kind === 'images'
                      ? `${ocrSource.images.length} صورة جاهزة`
                      : `ملف PDF · ${ocrSource.pageCount} صفحات`
                    : 'ملف PDF محمّل حالياً'}
                </p>
              </div>
            )}

            <div>
              <span className="block text-xs font-medium text-slate-600 mb-2">
                لغة المستند
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                {[
                  { id: 'auto' as const, label: 'تلقائي' },
                  { id: 'ar' as const, label: 'العربية' },
                  { id: 'en' as const, label: 'English' },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setOcrLang(l.id)}
                    className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                      ocrLang === l.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={(!ocrSource && !currentPdf) || busy}
              onClick={handleRunOcr}
              className="w-full min-h-[48px] rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ScanText className="w-4 h-4" />
              <span>استخراج النص الآن</span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">النص المستخرج القابل للتعديل</h3>
                {ocrResults.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {ocrResults[0].detectedLanguage} · {ocrResults.length} صفحات معالجة
                  </p>
                )}
              </div>

              {ocrCombinedText && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(ocrCombinedText);
                    onNotify('success', 'تم نسخ النص إلى الحافظة.');
                  }}
                  className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ</span>
                </button>
              )}
            </div>

            <textarea
              rows={11}
              value={ocrCombinedText}
              onChange={(e) => setOcrCombinedText(e.target.value)}
              placeholder="سيظهر النص المستخرج هنا لتتمكن من مراجعته وتعديله أو حفظه..."
              className="w-full rounded-xl border border-slate-200 p-3.5 text-sm leading-relaxed text-slate-900 focus:outline-none focus:border-red-600"
            />

            {ocrResults.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCreateSearchablePdf}
                    className="sm:col-span-3 min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>إنشاء PDF قابل للبحث والنسخ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadWordFromText(
                        ocrCombinedText,
                        (ocrSource?.name || 'ocr').replace(/\.[^.]+$/, '')
                      )
                    }
                    className="min-h-[44px] rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تصدير Word (.docx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadBlob(
                        new Blob([ocrCombinedText], { type: 'text/plain;charset=utf-8' }),
                        `${(ocrSource?.name || 'ocr').replace(/\.[^.]+$/, '')}.txt`
                      )
                    }
                    className="min-h-[44px] rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>تنزيل نص (.txt)</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const bytes = await textToPdfBytes(ocrCombinedText);
                      const name = `نص_منسق_OCR.pdf`;
                      downloadBlob(
                        new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                        name
                      );
                    }}
                    className="min-h-[44px] rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>PDF نصي نظيف</span>
                  </button>
                </div>

                {searchablePdf && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-900">
                      ملف PDF القابل للبحث جاهز ({formatBytes(searchablePdf.bytes.byteLength)})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(
                            new Blob([searchablePdf.bytes.buffer as ArrayBuffer], {
                              type: 'application/pdf',
                            }),
                            searchablePdf.name
                          )
                        }
                        className="min-h-[38px] px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        تنزيل
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPdfInEditor(searchablePdf.name, searchablePdf.bytes)
                        }
                        className="min-h-[38px] px-3 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold cursor-pointer"
                      >
                        فتح في المحرر
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 3: PDF -> Images */}
      {mode === 'pdf-to-img' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">تحويل PDF إلى صور</h2>
              <p className="text-sm text-slate-500">
                {currentPdf
                  ? `${currentPdf.name} · ${formatBytes(currentPdf.bytes.byteLength)}`
                  : 'اختر ملف PDF لتحويل صفحاته إلى صور عالية الدقة'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex p-1 bg-slate-100 rounded-xl">
                {(['png', 'jpeg'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setImgFormat(fmt)}
                    className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold uppercase cursor-pointer ${
                      imgFormat === fmt ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-xs md:text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                {currentPdf ? 'تغيير الملف' : 'اختيار PDF'}
              </button>
              {currentPdf && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePdfToImages}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs md:text-sm font-semibold hover:bg-red-700 cursor-pointer"
                >
                  تحويل الآن
                </button>
              )}
            </div>
          </div>

          {exportedImages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 tabular-nums">
                  {exportedImages.length} صور جاهزة
                </span>
                <button
                  type="button"
                  onClick={handleDownloadImagesZip}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل الكل (ZIP)</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {exportedImages.map((item) => (
                  <div
                    key={item.pageNumber}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2"
                  >
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-white">
                      <img
                        src={item.dataUrl}
                        alt={`صفحة ${item.pageNumber}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono-num text-slate-600">
                        صفحة {item.pageNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          downloadBlob(
                            item.blob,
                            `page_${item.pageNumber}.${imgFormat === 'png' ? 'png' : 'jpg'}`
                          )
                        }
                        className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-100 cursor-pointer"
                      >
                        حفظ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 4: PDF -> Word / Text */}
      {mode === 'pdf-to-word' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">تحويل PDF إلى Word أو نص</h2>
              <p className="text-sm text-slate-500">
                {currentPdf
                  ? `${currentPdf.name} · ${formatBytes(currentPdf.bytes.byteLength)}`
                  : 'اختر ملف PDF لاستخراج نصوصه وتصديرها بصيغة Word (.docx)'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-xs md:text-sm font-medium text-slate-800 cursor-pointer"
              >
                {currentPdf ? 'تغيير الملف' : 'اختيار PDF'}
              </button>
              {currentPdf && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleExtractDigitalText}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs md:text-sm font-semibold hover:bg-red-700 cursor-pointer"
                >
                  استخراج النصوص
                </button>
              )}
            </div>
          </div>

          {extractedPages.length > 0 && (
            <div className="space-y-4">
              <textarea
                rows={10}
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3.5 text-sm leading-relaxed text-slate-900 focus:outline-none focus:border-red-600"
              />
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadWordFromText(
                      editableText,
                      (currentPdf?.name || 'document').replace(/\.pdf$/i, '')
                    )
                  }
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل كملف Word (.docx)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadBlob(
                      new Blob([editableText], { type: 'text/plain;charset=utf-8' }),
                      `${(currentPdf?.name || 'document').replace(/\.pdf$/i, '')}.txt`
                    )
                  }
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm font-medium cursor-pointer"
                >
                  تنزيل نص (.txt)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('ocr')}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-red-600 text-xs font-semibold hover:bg-red-50 cursor-pointer"
                >
                  الملف ممسوح كصورة؟ جرّب OCR
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 5: Word / Text -> PDF */}
      {mode === 'word-to-pdf' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">تحويل Word أو نص إلى PDF</h2>
              <p className="text-sm text-slate-500">
                ارفع ملف DOCX أو TXT أو اكتب مستندك مباشرة بخط عربي واضح
              </p>
            </div>
            <button
              type="button"
              onClick={() => wordInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-medium flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>رفع ملف Word / TXT</span>
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="عنوان المستند (اختياري)"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:outline-none focus:border-red-600"
            />
            <textarea
              rows={9}
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="اكتب أو الصق النص هنا لتحويله إلى صفحات PDF منسقة..."
              className="w-full rounded-xl border border-slate-200 p-3.5 text-sm leading-relaxed text-slate-900 focus:outline-none focus:border-red-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!docText.trim() || busy}
              onClick={handleBuildPdfFromText}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 cursor-pointer"
            >
              تحويل إلى PDF
            </button>

            {textPdfResult && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    downloadBlob(
                      new Blob([textPdfResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                      textPdfResult.name
                    )
                  }
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ({formatBytes(textPdfResult.bytes.byteLength)})</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPdfInEditor(textPdfResult.name, textPdfResult.bytes)
                  }
                  className="min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-medium cursor-pointer"
                >
                  تعديل في المحرر
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleAddImages(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleAddImages(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handlePickPdf}
      />
      <input
        ref={wordInputRef}
        type="file"
        accept=".docx,.txt,.md"
        className="hidden"
        onChange={handleUploadWordOrText}
      />
      <input
        ref={ocrFileInputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          handleSelectOcrFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={ocrCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleSelectOcrFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
};
