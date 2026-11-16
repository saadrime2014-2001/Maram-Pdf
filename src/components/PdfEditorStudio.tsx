import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FilePlus2,
  Minimize2,
  PenLine,
  RotateCw,
  Scissors,
  Share2,
  Trash2,
  Layers,
  Undo2,
} from 'lucide-react';
import type {
  EditMode,
  PageAnnotation,
  PdfPagePreview,
  WatermarkConfig,
} from '../types/pdf';
import {
  applyPageOperationsAndAnnotations,
  compressPdf,
  downloadBlob,
  extractPdfPages,
  formatBytes,
  getPdfPageCount,
  mergePdfFiles,
  renderPdfThumbnails,
  shareFileIfSupported,
  splitAllPagesToZip,
} from '../utils/pdfEngine';
import { PageAnnotator } from './PageAnnotator';

interface PdfEditorStudioProps {
  initialMode: EditMode;
  activePdf: { name: string; bytes: Uint8Array } | null;
  onSelectNewPdf: () => void;
  onLoadSamplePdf: () => void;
  onSaveToHistory: (
    name: string,
    bytes: Uint8Array,
    pageCount: number,
    actionLabel: string
  ) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
  onAnnotatorActiveChange: (active: boolean) => void;
}

interface MergeItem {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

const EDIT_TABS: Array<{ id: EditMode; label: string }> = [
  { id: 'pages', label: 'تعديل وترتيب الصفحات' },
  { id: 'merge', label: 'دمج ملفات' },
  { id: 'split', label: 'تقسيم واستخراج' },
  { id: 'compress', label: 'ضغط الحجم' },
];

export const PdfEditorStudio: React.FC<PdfEditorStudioProps> = ({
  initialMode,
  activePdf,
  onSelectNewPdf,
  onLoadSamplePdf,
  onSaveToHistory,
  onNotify,
  onAnnotatorActiveChange,
}) => {
  const [mode, setMode] = useState<EditMode>(initialMode);
  const [busy, setBusy] = useState(false);

  // Page Organizer & Annotator state
  const [pages, setPages] = useState<PdfPagePreview[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [annotationsByPageId, setAnnotationsByPageId] = useState<
    Record<string, PageAnnotation[]>
  >({});
  const [watermark, setWatermark] = useState<WatermarkConfig>({
    enabled: false,
    text: '',
    opacity: 0.22,
    color: '#DC2626',
    angle: -35,
  });
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [savedOutput, setSavedOutput] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);

  // Merge state
  const [mergeList, setMergeList] = useState<MergeItem[]>([]);
  const [mergedResult, setMergedResult] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);

  // Split state
  const [selectedSplitIndices, setSelectedSplitIndices] = useState<number[]>([]);
  const [splitRangeInput, setSplitRangeInput] = useState('');

  // Compress state
  const [compressQuality, setCompressQuality] = useState<'high' | 'medium' | 'compact'>(
    'medium'
  );
  const [compressedResult, setCompressedResult] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);

  const mergeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    onAnnotatorActiveChange(Boolean(editingPageId));
  }, [editingPageId, onAnnotatorActiveChange]);

  useEffect(() => {
    if (!activePdf) {
      setPages([]);
      return;
    }
    let cancelled = false;
    setLoadingThumbs(true);
    setSavedOutput(null);
    setCompressedResult(null);
    setSelectedSplitIndices([]);
    setAnnotationsByPageId({});

    renderPdfThumbnails(activePdf.bytes, 0.55)
      .then((thumbs) => {
        if (!cancelled) {
          setPages(thumbs);
          // Seed merge list if empty
          setMergeList((prev) =>
            prev.length === 0
              ? [
                  {
                    id: `m_${Date.now()}`,
                    name: activePdf.name,
                    bytes: activePdf.bytes,
                    pageCount: thumbs.length,
                  },
                ]
              : prev
          );
        }
      })
      .catch(() => {
        if (!cancelled) onNotify('error', 'تعذر عرض صفحات هذا الملف.');
      })
      .finally(() => {
        if (!cancelled) setLoadingThumbs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activePdf]);

  const activePages = pages.filter((p) => !p.deleted);
  const editingPage = pages.find((p) => p.id === editingPageId) || null;
  const editingPageNum = editingPage
    ? activePages.findIndex((p) => p.id === editingPage.id) + 1
    : 1;

  const rotatePage = (id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const toggleDeletePage = (id: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target && !target.deleted && prev.filter((x) => !x.deleted).length <= 1) {
        onNotify('info', 'يجب أن يحتوي المستند على صفحة واحدة على الأقل.');
        return prev;
      }
      return prev.map((p) => (p.id === id ? { ...p, deleted: !p.deleted } : p));
    });
  };

  const movePage = (id: string, dir: -1 | 1) => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      let targetIdx = idx + dir;
      while (targetIdx >= 0 && targetIdx < prev.length && prev[targetIdx].deleted) {
        targetIdx += dir;
      }
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
      return copy;
    });
  };

  const handleSaveEditedPdf = async () => {
    if (!activePdf) return;
    setBusy(true);
    try {
      const outBytes = await applyPageOperationsAndAnnotations(
        activePdf.bytes,
        pages,
        annotationsByPageId,
        watermark
      );
      const base = activePdf.name.replace(/\.pdf$/i, '');
      const outName = `${base}_معدل.pdf`;
      const count = activePages.length;
      setSavedOutput({ name: outName, bytes: outBytes });
      await onSaveToHistory(outName, outBytes, count, 'تعديل وتوقيع');
      onNotify('success', 'تم حفظ جميع التعديلات وإعادة ترتيب الصفحات بنجاح.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'تعذر حفظ التعديلات.');
    } finally {
      setBusy(false);
    }
  };

  // Merge handlers
  const handleAddMergeFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const added: MergeItem[] = [];
    for (const f of Array.from(files)) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const pageCount = await getPdfPageCount(bytes);
      added.push({
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        bytes,
        pageCount,
      });
    }
    setMergeList((prev) => [...prev, ...added]);
    setMergedResult(null);
    e.target.value = '';
  };

  const moveMergeItem = (idx: number, dir: -1 | 1) => {
    setMergeList((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const handleMerge = async () => {
    if (mergeList.length < 2) {
      onNotify('info', 'أضف ملفين على الأقل لإتمام الدمج.');
      return;
    }
    setBusy(true);
    try {
      const outBytes = await mergePdfFiles(mergeList);
      const totalPages = mergeList.reduce((sum, x) => sum + x.pageCount, 0);
      const name = `ملف_مدمج_${Date.now().toString().slice(-4)}.pdf`;
      setMergedResult({ name, bytes: outBytes });
      await onSaveToHistory(name, outBytes, totalPages, 'دمج ملفات');
      onNotify('success', 'تم دمج الملفات في مستند واحد.');
    } catch {
      onNotify('error', 'حدث خطأ أثناء دمج الملفات.');
    } finally {
      setBusy(false);
    }
  };

  // Split handlers
  const parseRangeString = (raw: string, maxPages: number): number[] => {
    const set = new Set<number>();
    const parts = raw.split(/[,،\s]+/).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map((n) => parseInt(n, 10));
        if (!isNaN(a) && !isNaN(b)) {
          const start = Math.max(1, Math.min(a, b));
          const end = Math.min(maxPages, Math.max(a, b));
          for (let i = start; i <= end; i++) set.add(i - 1);
        }
      } else {
        const n = parseInt(part, 10);
        if (!isNaN(n) && n >= 1 && n <= maxPages) set.add(n - 1);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  };

  const handleExtractSelected = async () => {
    if (!activePdf) return;
    const indices =
      selectedSplitIndices.length > 0
        ? [...selectedSplitIndices].sort((a, b) => a - b)
        : parseRangeString(splitRangeInput, pages.length);

    if (indices.length === 0) {
      onNotify('info', 'اختر صفحات بالضغط عليها أو اكتب أرقام الصفحات مثل 1-3.');
      return;
    }

    setBusy(true);
    try {
      const out = await extractPdfPages(activePdf.bytes, indices);
      const name = `${activePdf.name.replace(/\.pdf$/i, '')}_مستخرج.pdf`;
      await onSaveToHistory(name, out, indices.length, 'تقسيم واستخراج');
      downloadBlob(new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' }), name);
      onNotify('success', `تم استخراج ${indices.length} صفحات بنجاح.`);
    } catch {
      onNotify('error', 'تعذر استخراج الصفحات المحددة.');
    } finally {
      setBusy(false);
    }
  };

  const handleSplitAllZip = async () => {
    if (!activePdf) return;
    setBusy(true);
    try {
      const zipBlob = await splitAllPagesToZip(activePdf.bytes, activePdf.name);
      downloadBlob(zipBlob, `${activePdf.name.replace(/\.pdf$/i, '')}_split_pages.zip`);
      onNotify('success', 'تم تقسيم كل صفحة في ملف مستقل داخل حزمة ZIP.');
    } catch {
      onNotify('error', 'تعذر تقسيم الصفحات.');
    } finally {
      setBusy(false);
    }
  };

  // Compress handler
  const handleCompress = async () => {
    if (!activePdf) return;
    setBusy(true);
    try {
      const outBytes = await compressPdf(activePdf.bytes, compressQuality);
      const name = `${activePdf.name.replace(/\.pdf$/i, '')}_مضغوط.pdf`;
      setCompressedResult({ name, bytes: outBytes });
      await onSaveToHistory(name, outBytes, pages.length, 'ضغط الحجم');
      onNotify('success', 'تم ضغط الملف بنجاح.');
    } catch {
      onNotify('error', 'تعذر ضغط هذا الملف.');
    } finally {
      setBusy(false);
    }
  };

  if (editingPage && activePdf) {
    return (
      <PageAnnotator
        sourceBytes={activePdf.bytes}
        page={editingPage}
        pageNumber={editingPageNum}
        totalPages={activePages.length}
        initialAnnotations={annotationsByPageId[editingPage.id] || []}
        watermark={watermark}
        onSavePage={(pid, anns, wm) => {
          setAnnotationsByPageId((prev) => ({ ...prev, [pid]: anns }));
          setWatermark(wm);
          setEditingPageId(null);
          onNotify('success', 'تم حفظ تعديلات الصفحة. اضغط "حفظ وتصدير الملف" لتنزيل النسخة النهائية.');
        }}
        onApplyToAllPages={(imgAnn) => {
          setAnnotationsByPageId((prev) => {
            const next = { ...prev };
            for (const p of activePages) {
              if (p.id === editingPage.id) continue;
              const existing = next[p.id] || [];
              next[p.id] = [
                ...existing,
                {
                  ...imgAnn,
                  id: `${imgAnn.type}_all_${p.id}_${Date.now()}`,
                },
              ];
            }
            return next;
          });
          onNotify('success', 'تم تطبيق التوقيع/الصورة على جميع صفحات المستند.');
        }}
        onClose={() => setEditingPageId(null)}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 pb-28 md:pb-12 space-y-6">
      {/* Sub-mode tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl overflow-x-auto no-scrollbar">
        {EDIT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs md:text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              mode === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Empty state if no active PDF for pages/split/compress */}
      {!activePdf && mode !== 'merge' ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 text-center space-y-4">
          <h2 className="text-lg font-bold text-slate-900">لم تختر ملف PDF بعد</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            اختر ملفاً من هاتفك للبدء في تعديل النصوص، إدراج الصور، التوقيع، أو إعادة ترتيب الصفحات.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onSelectNewPdf}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 cursor-pointer"
            >
              اختيار ملف من الجهاز
            </button>
            <button
              type="button"
              onClick={onLoadSamplePdf}
              className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer"
            >
              تجربة بملف جاهز
            </button>
          </div>
        </div>
      ) : null}

      {/* MODE: PAGES ORGANIZER & ANNOTATE */}
      {mode === 'pages' && activePdf && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                {activePdf.name}
              </h2>
              <p className="text-xs text-slate-500 font-mono-num">
                {activePages.length} صفحة نشطة · {formatBytes(activePdf.bytes.byteLength)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSelectNewPdf}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                تغيير الملف
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveEditedPdf}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs md:text-sm font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{busy ? 'جاري الحفظ...' : 'حفظ وتصدير الملف'}</span>
              </button>
            </div>
          </div>

          {savedOutput && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  تم تجهيز الملف المعدل
                </p>
                <p className="text-xs text-emerald-800 font-mono-num">
                  {savedOutput.name} · {formatBytes(savedOutput.bytes.byteLength)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadBlob(
                      new Blob([savedOutput.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                      savedOutput.name
                    )
                  }
                  className="min-h-[42px] px-4 rounded-xl bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    shareFileIfSupported(
                      new Blob([savedOutput.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                      savedOutput.name
                    ).then((ok) => {
                      if (!ok) {
                        downloadBlob(
                          new Blob([savedOutput.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                          savedOutput.name
                        );
                      }
                    })
                  }
                  className="min-h-[42px] px-4 rounded-xl bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة</span>
                </button>
              </div>
            </div>
          )}

          {loadingThumbs ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center text-sm text-slate-500">
              جاري عرض معاينة الصفحات...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {pages.map((p) => {
                const activeIndex = activePages.findIndex((x) => x.id === p.id);
                const annCount = (annotationsByPageId[p.id] || []).length;
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border bg-white p-3 flex flex-col gap-2.5 transition-opacity ${
                      p.deleted
                        ? 'opacity-45 border-dashed border-slate-300'
                        : 'border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={p.deleted}
                      onClick={() => setEditingPageId(p.id)}
                      className="relative aspect-[3/4] rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center cursor-pointer group"
                    >
                      <img
                        src={p.thumbnailUrl}
                        alt={`صفحة ${p.originalIndex + 1}`}
                        style={{ transform: `rotate(${p.rotation}deg)` }}
                        className="max-h-full max-w-full object-contain transition-transform"
                      />
                      {!p.deleted && (
                        <div className="absolute inset-x-0 bottom-0 bg-slate-900/75 text-white text-[11px] font-medium py-1.5 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <PenLine className="w-3.5 h-3.5" />
                          <span>تعديل / إضافة نص</span>
                        </div>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-mono-num font-semibold">
                        {p.deleted ? 'محذوفة' : `صفحة ${activeIndex + 1}`}
                      </span>
                      {annCount > 0 && !p.deleted && (
                        <span className="text-[11px] font-medium text-red-600 tabular-nums">
                          {annCount} تعديل
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={p.deleted}
                        onClick={() => movePage(p.id, -1)}
                        aria-label="نقل لليمين"
                        className="min-h-[38px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={p.deleted}
                        onClick={() => movePage(p.id, 1)}
                        aria-label="نقل لليسار"
                        className="min-h-[38px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={p.deleted}
                        onClick={() => rotatePage(p.id)}
                        aria-label="تدوير 90 درجة"
                        className="min-h-[38px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDeletePage(p.id)}
                        aria-label={p.deleted ? 'استعادة الصفحة' : 'حذف الصفحة'}
                        className={`min-h-[38px] min-w-[36px] flex items-center justify-center rounded-lg cursor-pointer ${
                          p.deleted
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        {p.deleted ? (
                          <Undo2 className="w-4 h-4" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODE: MERGE */}
      {mode === 'merge' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">دمج عدة ملفات PDF</h2>
              <p className="text-sm text-slate-500">
                أضف الملفات ورتبها كما تريد ثم ادمجها في ملف واحد
              </p>
            </div>
            <button
              type="button"
              onClick={() => mergeInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>إضافة ملفات PDF</span>
            </button>
          </div>

          {mergeList.length === 0 ? (
            <button
              type="button"
              onClick={() => mergeInputRef.current?.click()}
              className="w-full py-12 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-600 hover:border-red-300 cursor-pointer"
            >
              اضغط لاختيار ملفين أو أكثر من هاتفك
            </button>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {mergeList.map((item, idx) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 bg-white"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {idx + 1}. {item.name}
                    </p>
                    <p className="text-xs text-slate-500 font-mono-num">
                      {item.pageCount} صفحات · {formatBytes(item.bytes.byteLength)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveMergeItem(idx, -1)}
                      className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4 rotate-90" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === mergeList.length - 1}
                      onClick={() => moveMergeItem(idx, 1)}
                      className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMergeList((prev) => prev.filter((x) => x.id !== item.id))
                      }
                      className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={mergeList.length < 2 || busy}
              onClick={handleMerge}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>دمج {mergeList.length} ملفات</span>
            </button>
            {mergedResult && (
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    new Blob([mergedResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                    mergedResult.name
                  )
                }
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل ({formatBytes(mergedResult.bytes.byteLength)})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODE: SPLIT */}
      {mode === 'split' && activePdf && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">تقسيم واستخراج الصفحات</h2>
              <p className="text-sm text-slate-500">
                اضغط على الصفحات المطلوبة أو أدخل النطاق مثل 1-3, 5
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                dir="ltr"
                value={splitRangeInput}
                onChange={(e) => setSplitRangeInput(e.target.value)}
                placeholder="1-3, 5"
                className="w-32 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono-num text-center"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleExtractSelected}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs md:text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Scissors className="w-4 h-4" />
                <span>استخراج المحدد ({selectedSplitIndices.length})</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSplitAllZip}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs md:text-sm font-medium cursor-pointer"
              >
                تقسيم الكل (ZIP)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {pages.map((p, idx) => {
              const isSelected = selectedSplitIndices.includes(idx);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setSelectedSplitIndices((prev) =>
                      prev.includes(idx)
                        ? prev.filter((x) => x !== idx)
                        : [...prev, idx]
                    )
                  }
                  className={`rounded-xl border-2 p-2 text-center space-y-1.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-red-600 bg-red-50/40'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="aspect-[3/4] rounded-lg overflow-hidden bg-white">
                    <img
                      src={p.thumbnailUrl}
                      alt={`صفحة ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-xs font-mono-num font-semibold text-slate-700">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE: COMPRESS */}
      {mode === 'compress' && activePdf && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 max-w-2xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900">ضغط وتصغير حجم PDF</h2>
            <p className="text-sm text-slate-500 font-mono-num">
              {activePdf.name} · الحجم الحالي: {formatBytes(activePdf.bytes.byteLength)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'high' as const, title: 'جودة عالية', desc: 'مناسب للطباعة مع تقليل خفيف' },
              { id: 'medium' as const, title: 'توازن مثالي', desc: 'أوضح قراءة بأصغر حجم' },
              { id: 'compact' as const, title: 'حجم للمراسلة', desc: 'أقصى ضغط للإرسال السريع' },
            ].map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setCompressQuality(q.id)}
                className={`p-3.5 rounded-2xl border text-right space-y-1 cursor-pointer transition-all ${
                  compressQuality === q.id
                    ? 'border-red-600 bg-red-50/40'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-bold text-slate-900">{q.title}</p>
                <p className="text-xs text-slate-500">{q.desc}</p>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleCompress}
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center gap-2 cursor-pointer"
          >
            <Minimize2 className="w-4 h-4" />
            <span>{busy ? 'جاري الضغط...' : 'ضغط الملف الآن'}</span>
          </button>

          {compressedResult && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900">تم ضغط الملف</p>
                <p className="text-xs text-slate-600 font-mono-num">
                  الحجم الجديد: {formatBytes(compressedResult.bytes.byteLength)} (توفير{' '}
                  {Math.max(
                    0,
                    Math.round(
                      (1 -
                        compressedResult.bytes.byteLength /
                          activePdf.bytes.byteLength) *
                        100
                    )
                  )}
                  %)
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    new Blob([compressedResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                    compressedResult.name
                  )
                }
                className="min-h-[42px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل</span>
              </button>
            </div>
          )}
        </div>
      )}

      <input
        ref={mergeInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={handleAddMergeFiles}
      />
    </div>
  );
};
