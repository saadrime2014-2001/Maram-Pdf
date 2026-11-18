import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FilePlus2,
  Minimize2,
  PenLine,
  Printer,
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
  printPdfBytes,
  renderPdfThumbnails,
  shareFileIfSupported,
  splitAllPagesToZip,
} from '../utils/pdfEngine';
import { PageAnnotator } from './PageAnnotator';

interface PdfEditorStudioProps {
  initialMode: EditMode;
  activePdf: { name: string; bytes: Uint8Array } | null;
  currentLang: 'ar' | 'en' | 'fr' | 'es';
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

const translations = {
  ar: {
    tabs: [
      { id: 'pages', label: 'تعديل وترتيب الصفحات' },
      { id: 'merge', label: 'دمج ملفات' },
      { id: 'split', label: 'تقسيم واستخراج' },
      { id: 'compress', label: 'ضغط الحجم' },
    ],
    noPdfTitle: 'لم تختر ملف PDF بعد',
    noPdfDesc: 'اختر ملفاً من هاتفك للبدء في تعديل النصوص، إدراج الصور، التوقيع، أو إعادة ترتيب الصفحات.',
    chooseFile: 'اختيار ملف من الجهاز',
    trySample: 'تجربة بملف جاهز',
    activePages: 'صفحة نشطة',
    print: 'طباعة',
    share: 'مشاركة',
    changeFile: 'تغيير الملف',
    saveAndExport: 'حفظ وتصدير الملف',
    saving: 'جاري الحفظ...',
    readyOutput: 'تم تجهيز الملف المعدل',
    save: 'حفظ',
    loadingThumbs: 'جاري عرض معاينة الصفحات...',
    editOrAddText: 'تعديل / إضافة نص',
    deleted: 'محذوفة',
    page: 'صفحة',
    editCount: 'تعديل',
    mergeTitle: 'دمج عدة ملفات PDF',
    mergeDesc: 'أضف الملفات ورتبها كما تريد ثم ادمجها في ملف واحد',
    addPdfFiles: 'إضافة ملفات PDF',
    mergePrompt: 'اضغط لاختيار ملفين أو أكثر من هاتفك',
    mergeBtn: 'دمج الملفات',
    splitTitle: 'تقسيم واستخراج الصفحات',
    splitDesc: 'اضغط على الصفحات المطلوبة أو أدخل النطاق مثل 1-3, 5',
    extractSelected: 'استخراج المحدد',
    splitAllZip: 'تقسيم الكل (ZIP)',
    compressTitle: 'ضغط وتصغير حجم PDF',
    currentSize: 'الحجم الحالي',
    compressQuality: [
      { id: 'high', title: 'جودة عالية', desc: 'مناسب للطباعة مع تقليل خفيف' },
      { id: 'medium', title: 'توازن مثالي', desc: 'أوضح قراءة بأصغر حجم' },
      { id: 'compact', title: 'حجم للمراسلة', desc: 'أقصى ضغط للإرسال السريع' },
    ],
    compressBtn: 'ضغط الملف الآن',
    compressing: 'جاري الضغط...',
    compressedSuccess: 'تم ضغط الملف',
    newSize: 'الحجم الجديد',
    savingPercent: 'توفير',
  },
  en: {
    tabs: [
      { id: 'pages', label: 'Edit & Reorder Pages' },
      { id: 'merge', label: 'Merge PDFs' },
      { id: 'split', label: 'Split & Extract' },
      { id: 'compress', label: 'Compress Size' },
    ],
    noPdfTitle: 'No PDF selected yet',
    noPdfDesc: 'Choose a file from your phone to start editing texts, adding images, signatures, or reordering pages.',
    chooseFile: 'Choose file from device',
    trySample: 'Try sample file',
    activePages: 'active pages',
    print: 'Print',
    share: 'Share',
    changeFile: 'Change file',
    saveAndExport: 'Save & Export',
    saving: 'Saving...',
    readyOutput: 'Modified file ready',
    save: 'Save',
    loadingThumbs: 'Loading page previews...',
    editOrAddText: 'Edit / Add text',
    deleted: 'Deleted',
    page: 'Page',
    editCount: 'edit',
    mergeTitle: 'Merge Multiple PDFs',
    mergeDesc: 'Add files, reorder them as you wish, and merge into a single document.',
    addPdfFiles: 'Add PDF Files',
    mergePrompt: 'Click to choose two or more files from your phone',
    mergeBtn: 'Merge Files',
    splitTitle: 'Split & Extract Pages',
    splitDesc: 'Tap desired pages or enter range like 1-3, 5',
    extractSelected: 'Extract Selected',
    splitAllZip: 'Split All (ZIP)',
    compressTitle: 'Compress & Reduce PDF Size',
    currentSize: 'Current Size',
    compressQuality: [
      { id: 'high', title: 'High Quality', desc: 'Suitable for printing with light reduction' },
      { id: 'medium', title: 'Balanced', desc: 'Clear reading with minimal size' },
      { id: 'compact', title: 'Messaging Size', desc: 'Maximum compression for fast sending' },
    ],
    compressBtn: 'Compress File Now',
    compressing: 'Compressing...',
    compressedSuccess: 'File compressed',
    newSize: 'New Size',
    savingPercent: 'Saved',
  },
  fr: {
    tabs: [
      { id: 'pages', label: 'Éditer & Réorganiser' },
      { id: 'merge', label: 'Fusionner' },
      { id: 'split', label: 'Diviser & Extraire' },
      { id: 'compress', label: 'Compresser' },
    ],
    noPdfTitle: 'Aucun PDF sélectionné',
    noPdfDesc: 'Choisissez un fichier pour modifier les textes, signer ou réorganiser.',
    chooseFile: 'Choisir un fichier',
    trySample: 'Essayer un exemple',
    activePages: 'pages actives',
    print: 'Imprimer',
    share: 'Partager',
    changeFile: 'Changer',
    saveAndExport: 'Enregistrer & Exporter',
    saving: 'Enregistrement...',
    readyOutput: 'Fichier modifié prêt',
    save: 'Enregistrer',
    loadingThumbs: 'Chargement des aperçus...',
    editOrAddText: 'Éditer / Ajouter du texte',
    deleted: 'Supprimé',
    page: 'Page',
    editCount: 'modif',
    mergeTitle: 'Fusionner des PDF',
    mergeDesc: 'Ajoutez des fichiers, organisez-les et fusionnez en un seul.',
    addPdfFiles: 'Ajouter des PDF',
    mergePrompt: 'Cliquez pour choisir des fichiers',
    mergeBtn: 'Fusionner',
    splitTitle: 'Diviser & Extraire les pages',
    splitDesc: 'Touchez les pages ou entrez une plage ex: 1-3, 5',
    extractSelected: 'Extraire la sélection',
    splitAllZip: 'Tout diviser (ZIP)',
    compressTitle: 'Compresser la taille du PDF',
    currentSize: 'Taille actuelle',
    compressQuality: [
      { id: 'high', title: 'Haute qualité', desc: 'Idéal pour impression' },
      { id: 'medium', title: 'Équilibré', desc: 'Bonne lecture et petite taille' },
      { id: 'compact', title: 'Compact', desc: 'Compression maximale' },
    ],
    compressBtn: 'Compresser maintenant',
    compressing: 'Compression...',
    compressedSuccess: 'Fichier compressé',
    newSize: 'Nouvelle taille',
    savingPercent: 'Économie',
  },
  es: {
    tabs: [
      { id: 'pages', label: 'Editar y Reordenar' },
      { id: 'merge', label: 'Unir PDFs' },
      { id: 'split', label: 'Dividir y Extraer' },
      { id: 'compress', label: 'Comprimir Tamaño' },
    ],
    noPdfTitle: 'Ningún PDF seleccionado',
    noPdfDesc: 'Elige un archivo de tu teléfono para editar textos, añadir firmas o reordenar.',
    chooseFile: 'Elegir archivo',
    trySample: 'Probar muestra',
    activePages: 'páginas activas',
    print: 'Imprimir',
    share: 'Compartir',
    changeFile: 'Cambiar archivo',
    saveAndExport: 'Guardar y Exportar',
    saving: 'Guardando...',
    readyOutput: 'Archivo modificado listo',
    save: 'Guardar',
    loadingThumbs: 'Cargando vistas previas...',
    editOrAddText: 'Editar / Añadir texto',
    deleted: 'Eliminada',
    page: 'Página',
    editCount: 'edición',
    mergeTitle: 'Unir Varios PDFs',
    mergeDesc: 'Añade archivos, ordénalos y únelos en un solo documento.',
    addPdfFiles: 'Añadir archivos PDF',
    mergePrompt: 'Haz clic para elegir archivos de tu teléfono',
    mergeBtn: 'Unir Archivos',
    splitTitle: 'Dividir y Extraer Páginas',
    splitDesc: 'Toca las páginas deseadas o introduce un rango como 1-3, 5',
    extractSelected: 'Extraer Seleccionadas',
    splitAllZip: 'Dividir Todo (ZIP)',
    compressTitle: 'Comprimir y Reducir Tamaño de PDF',
    currentSize: 'Tamaño actual',
    compressQuality: [
      { id: 'high', title: 'Alta Calidad', desc: 'Ideal para impresión' },
      { id: 'medium', title: 'Equilibrado', desc: 'Buena lectura y tamaño reducido' },
      { id: 'compact', title: 'Tamaño Mensajería', desc: 'Máxima compresión' },
    ],
    compressBtn: 'Comprimir Archivo Ahora',
    compressing: 'Comprimiendo...',
    compressedSuccess: 'Archivo comprimido',
    newSize: 'Nuevo tamaño',
    savingPercent: 'Ahorro',
  },
};

export const PdfEditorStudio: React.FC<PdfEditorStudioProps> = ({
  initialMode,
  activePdf,
  currentLang,
  onSelectNewPdf,
  onLoadSamplePdf,
  onSaveToHistory,
  onNotify,
  onAnnotatorActiveChange,
}) => {
  const t = translations[currentLang];
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
        if (!cancelled) onNotify('error', 'Error loading thumbnails.');
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
        onNotify('info', 'At least one page is required.');
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
      const outName = `${base}_edited.pdf`;
      const count = activePages.length;
      setSavedOutput({ name: outName, bytes: outBytes });
      await onSaveToHistory(outName, outBytes, count, 'Edit & Sign');
      onNotify('success', 'Changes saved successfully.');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Error saving changes.');
    } finally {
      setBusy(false);
    }
  };

  const handleShareOrDownload = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    shareFileIfSupported(blob, filename).then((ok) => {
      if (!ok) {
        downloadBlob(blob, filename);
      }
    });
  };

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
    if (mergeList.length < 2) return;
    setBusy(true);
    try {
      const outBytes = await mergePdfFiles(mergeList);
      const totalPages = mergeList.reduce((sum, x) => sum + x.pageCount, 0);
      const name = `merged_${Date.now().toString().slice(-4)}.pdf`;
      setMergedResult({ name, bytes: outBytes });
      await onSaveToHistory(name, outBytes, totalPages, 'Merge PDFs');
      onNotify('success', 'Files merged successfully.');
    } catch {
      onNotify('error', 'Error merging files.');
    } finally {
      setBusy(false);
    }
  };

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

    if (indices.length === 0) return;

    setBusy(true);
    try {
      const out = await extractPdfPages(activePdf.bytes, indices);
      const name = `${activePdf.name.replace(/\.pdf$/i, '')}_extracted.pdf`;
      await onSaveToHistory(name, out, indices.length, 'Extract Pages');
      downloadBlob(new Blob([out.buffer as ArrayBuffer], { type: 'application/pdf' }), name);
      onNotify('success', `Extracted ${indices.length} pages.`);
    } catch {
      onNotify('error', 'Error extracting pages.');
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
      onNotify('success', 'Split all pages into ZIP.');
    } catch {
      onNotify('error', 'Error splitting pages.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompress = async () => {
    if (!activePdf) return;
    setBusy(true);
    try {
      const outBytes = await compressPdf(activePdf.bytes, compressQuality);
      const name = `${activePdf.name.replace(/\.pdf$/i, '')}_compressed.pdf`;
      setCompressedResult({ name, bytes: outBytes });
      await onSaveToHistory(name, outBytes, pages.length, 'Compress PDF');
      onNotify('success', 'PDF compressed successfully.');
    } catch {
      onNotify('error', 'Error compressing file.');
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
          onNotify('success', 'Page saved.');
        }}
        onApplyToAllPages={(imgAnn) => {
          setAnnotationsByPageId((prev) => {
            const next = { ...prev };
            for (const p of activePages) {
              if (p.id === editingPage.id) continue;
              const existing = next[p.id] || [];
              next[p.id] = [
                ...existing,
                { ...imgAnn, id: `${imgAnn.type}_all_${p.id}_${Date.now()}` },
              ];
            }
            return next;
          });
          onNotify('success', 'Applied to all pages.');
        }}
        onClose={() => setEditingPageId(null)}
      />
    );
  }

  return (
    <div className={`max-w-6xl mx-auto px-4 md:px-6 py-5 pb-28 md:pb-12 space-y-6 ${currentLang === 'ar' ? 'text-right' : 'text-left'}`}>
      {/* Sub-mode tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl overflow-x-auto no-scrollbar">
        {t.tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id as EditMode)}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs md:text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              mode === item.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!activePdf && mode !== 'merge' ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 text-center space-y-4">
          <h2 className="text-lg font-bold text-slate-900">{t.noPdfTitle}</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{t.noPdfDesc}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onSelectNewPdf}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 cursor-pointer"
            >
              {t.chooseFile}
            </button>
            <button
              type="button"
              onClick={onLoadSamplePdf}
              className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-medium hover:bg-slate-50 cursor-pointer"
            >
              {t.trySample}
            </button>
          </div>
        </div>
      ) : null}

      {/* MODE: PAGES */}
      {mode === 'pages' && activePdf && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                {activePdf.name}
              </h2>
              <p className="text-xs text-slate-500 font-mono-num">
                {activePages.length} {t.activePages} · {formatBytes(activePdf.bytes.byteLength)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => printPdfBytes(activePdf.bytes, activePdf.name)}
                title={t.print}
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleShareOrDownload(activePdf.bytes, activePdf.name)}
                title={t.share}
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onSelectNewPdf}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t.changeFile}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveEditedPdf}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs md:text-sm font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{busy ? t.saving : t.saveAndExport}</span>
              </button>
            </div>
          </div>

          {savedOutput && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-emerald-900">{t.readyOutput}</p>
                <p className="text-xs text-emerald-800 font-mono-num">
                  {savedOutput.name} · {formatBytes(savedOutput.bytes.byteLength)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                  <span>{t.save}</span>
                </button>
              </div>
            </div>
          )}

          {loadingThumbs ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center text-sm text-slate-500">
              {t.loadingThumbs}
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
                      p.deleted ? 'opacity-45 border-dashed border-slate-300' : 'border-slate-200'
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
                        alt={`Page`}
                        style={{ transform: `rotate(${p.rotation}deg)` }}
                        className="max-h-full max-w-full object-contain transition-transform"
                      />
                      {!p.deleted && (
                        <div className="absolute inset-x-0 bottom-0 bg-slate-900/75 text-white text-[11px] font-medium py-1.5 opacity-95 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <PenLine className="w-3.5 h-3.5" />
                          <span>{t.editOrAddText}</span>
                        </div>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-mono-num font-semibold">
                        {p.deleted ? t.deleted : `${t.page} ${activeIndex + 1}`}
                      </span>
                      {annCount > 0 && !p.deleted && (
                        <span className="text-[11px] font-medium text-red-600 tabular-nums">
                          {annCount} {t.editCount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={p.deleted}
                        onClick={() => movePage(p.id, -1)}
                        className="min-h-[38px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={p.deleted}
                        onClick={() => movePage(p.id, 1)}
                        className="min-h-[38px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={p.deleted}
                        onClick={() => rotatePage(p.id)}
                        className="min-h-[38px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDeletePage(p.id)}
                        className={`min-h-[38px] min-w-[36px] flex items-center justify-center rounded-lg cursor-pointer ${
                          p.deleted ? 'text-emerald-700 hover:bg-emerald-50' : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        {p.deleted ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
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
              <h2 className="text-lg font-bold text-slate-900">{t.mergeTitle}</h2>
              <p className="text-sm text-slate-500">{t.mergeDesc}</p>
            </div>
            <button
              type="button"
              onClick={() => mergeInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>{t.addPdfFiles}</span>
            </button>
          </div>

          {mergeList.length === 0 ? (
            <button
              type="button"
              onClick={() => mergeInputRef.current?.click()}
              className="w-full py-12 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-600 hover:border-red-300 cursor-pointer"
            >
              {t.mergePrompt}
            </button>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {mergeList.map((item, idx) => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3 bg-white">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {idx + 1}. {item.name}
                    </p>
                    <p className="text-xs text-slate-500 font-mono-num">
                      {item.pageCount} pages · {formatBytes(item.bytes.byteLength)}
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
                      onClick={() => setMergeList((prev) => prev.filter((x) => x.id !== item.id))}
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
              <span>{t.mergeBtn}</span>
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
                <span>{t.save} ({formatBytes(mergedResult.bytes.byteLength)})</span>
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
              <h2 className="text-lg font-bold text-slate-900">{t.splitTitle}</h2>
              <p className="text-sm text-slate-500">{t.splitDesc}</p>
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
                <span>{t.extractSelected} ({selectedSplitIndices.length})</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSplitAllZip}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs md:text-sm font-medium cursor-pointer"
              >
                {t.splitAllZip}
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
                      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
                    )
                  }
                  className={`rounded-xl border-2 p-2 text-center space-y-1.5 cursor-pointer transition-all ${
                    isSelected ? 'border-red-600 bg-red-50/40' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="aspect-[3/4] rounded-lg overflow-hidden bg-white">
                    <img src={p.thumbnailUrl} alt={`Page`} className="w-full h-full object-contain" />
                  </div>
                  <span className="text-xs font-mono-num font-semibold text-slate-700">{idx + 1}</span>
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
            <h2 className="text-lg font-bold text-slate-900">{t.compressTitle}</h2>
            <p className="text-sm text-slate-500 font-mono-num">
              {activePdf.name} · {t.currentSize}: {formatBytes(activePdf.bytes.byteLength)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {t.compressQuality.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setCompressQuality(q.id as any)}
                className={`p-3.5 rounded-2xl border text-right space-y-1 cursor-pointer transition-all ${
                  compressQuality === q.id ? 'border-red-600 bg-red-50/40' : 'border-slate-200 hover:border-slate-300'
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
            <span>{busy ? t.compressing : t.compressBtn}</span>
          </button>

          {compressedResult && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900">{t.compressedSuccess}</p>
                <p className="text-xs text-slate-600 font-mono-num">
                  {t.newSize}: {formatBytes(compressedResult.bytes.byteLength)} ({t.savingPercent}{' '}
                  {Math.max(0, Math.round((1 - compressedResult.bytes.byteLength / activePdf.bytes.byteLength) * 100))}%)
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
                <span>{t.save}</span>
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
