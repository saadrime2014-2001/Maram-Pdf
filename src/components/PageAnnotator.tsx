import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Highlighter,
  ImagePlus,
  Pen,
  PenTool,
  Stamp,
  Trash2,
  Type as TypeIcon,
  Undo2,
  MousePointer,
  Replace,
  Bold,
  AlignRight,
  AlignCenter,
  AlignLeft,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react';
import type {
  ImageAnnotation,
  PageAnnotation,
  PdfPagePreview,
  StrokeAnnotation,
  TextAnnotation,
  TextFontFamily,
  WatermarkConfig,
} from '../types/pdf';
import {
  DetectedTextBlock,
  extractPageTextBlocks,
  renderSinglePdfPage,
} from '../utils/pdfEngine';
import { SignatureSheet } from './SignatureSheet';

interface PageAnnotatorProps {
  sourceBytes: Uint8Array;
  page: PdfPagePreview;
  pageNumber: number;
  totalPages: number;
  initialAnnotations: PageAnnotation[];
  watermark: WatermarkConfig;
  currentLang?: 'ar' | 'en' | 'fr' | 'es';
  onSavePage: (
    pageId: string,
    annotations: PageAnnotation[],
    watermark: WatermarkConfig
  ) => void;
  onApplyToAllPages?: (annotation: ImageAnnotation) => void;
  onClose: () => void;
}

type ActiveTool = 'select' | 'pen' | 'highlight' | 'text' | 'image' | 'signature';

const COLOR_SWATCHES = [
  '#0F172A',
  '#DC2626',
  '#1D4ED8',
  '#047857',
  '#B45309',
  '#6D28D9',
];

const HIGHLIGHT_SWATCHES = ['#FACC15', '#4ADE80', '#FB7185', '#60A5FA'];

const translations = {
  ar: {
    back: 'رجوع',
    pageOf: (p: number, total: number) => `صفحة ${p} من ${total}`,
    zoomOut: 'تصغير',
    zoomIn: 'تكبير',
    undo: 'تراجع',
    savePage: 'حفظ الصفحة',
    loadingPage: 'جاري تجهيز الصفحة عالية الدقة...',
    defaultText: 'اكتب النص هنا',
    emptyText: 'نص فارغ',
    textPropsTitle: 'تعديل خصائص النص',
    deleteText: 'حذف النص',
    closeProps: 'إغلاق الخصائص',
    enterTextPlaceholder: 'أدخل النص...',
    fontFamily: 'نوع الخط',
    fontSans: 'حديث',
    fontSerif: 'كلاسيكي',
    fontMono: 'تقني',
    size: 'الحجم',
    lineWidth: 'عرض السطر',
    bold: 'خط عريض',
    alignRight: 'محاذاة لليمين',
    alignCenter: 'توسيط',
    alignLeft: 'محاذاة لليسار',
    whiteBgCover: 'خلفية بيضاء لتغطية نص قديم تحته',
    editSigProps: 'تعديل حجم وموضع التوقيع',
    editImgProps: 'تعديل الصورة المدرجة',
    delete: 'حذف',
    opacity: 'الشفافية',
    applyToAll: (total: number) => `تطبيق على جميع الصفحات (${total})`,
    penProps: 'خصائص القلم الحر',
    highlightProps: 'خصائص التظليل',
    strokeWidth: 'سُمك الخط',
    toolMove: 'تحريك',
    toolAddText: 'إضافة نص',
    toolEditText: 'تعديل نص',
    toolAddImg: 'إدراج صورة',
    toolSign: 'توقيع',
    toolPen: 'قلم',
    toolHighlight: 'تظليل',
    toolWatermark: 'علامة مائية',
    pickLineTitle: 'اختر سطراً لتعديله واستبداله',
    readingText: 'جاري قراءة نصوص الصفحة...',
    noDigitalTextTitle: 'لم يتم العثور على نصوص رقمية مباشرة في هذه الصفحة.',
    noDigitalTextDesc:
      'إذا كانت الصفحة ممسوحة ضوئياً كصورة، يمكنك استخدام أداة إضافة نص بخلفية بيضاء لتغطية الجزء المطلوب أو استخدام أداة OCR في المحول.',
    replacementText: 'نص بديل',
    addWhiteBgBox: 'إضافة صندوق نص بخلفية بيضاء',
    watermarkModalTitle: 'العلامة المائية للمستند',
    enableWatermark: 'تفعيل العلامة المائية',
    watermarkTextLabel: 'نص العلامة المائية',
    watermarkPlaceholder: 'مثال: سري للغاية / نسخة أصلية',
    angle: 'الميل',
    apply: 'تطبيق',
  },
  en: {
    back: 'Back',
    pageOf: (p: number, total: number) => `Page ${p} of ${total}`,
    zoomOut: 'Zoom Out',
    zoomIn: 'Zoom In',
    undo: 'Undo',
    savePage: 'Save Page',
    loadingPage: 'Preparing high-resolution page...',
    defaultText: 'Type text here',
    emptyText: 'Empty text',
    textPropsTitle: 'Edit Text Properties',
    deleteText: 'Delete text',
    closeProps: 'Close properties',
    enterTextPlaceholder: 'Enter text...',
    fontFamily: 'Font Family',
    fontSans: 'Modern',
    fontSerif: 'Classic',
    fontMono: 'Mono',
    size: 'Size',
    lineWidth: 'Line Width',
    bold: 'Bold',
    alignRight: 'Align Right',
    alignCenter: 'Center',
    alignLeft: 'Align Left',
    whiteBgCover: 'White background to cover old text underneath',
    editSigProps: 'Edit Signature Size & Position',
    editImgProps: 'Edit Inserted Image',
    delete: 'Delete',
    opacity: 'Opacity',
    applyToAll: (total: number) => `Apply to all pages (${total})`,
    penProps: 'Freehand Pen Properties',
    highlightProps: 'Highlighter Properties',
    strokeWidth: 'Stroke Width',
    toolMove: 'Move',
    toolAddText: 'Add Text',
    toolEditText: 'Edit Text',
    toolAddImg: 'Add Image',
    toolSign: 'Signature',
    toolPen: 'Pen',
    toolHighlight: 'Highlight',
    toolWatermark: 'Watermark',
    pickLineTitle: 'Select a line to edit & replace',
    readingText: 'Reading page text...',
    noDigitalTextTitle: 'No direct digital text found on this page.',
    noDigitalTextDesc:
      'If this page is a scanned image, you can add a text box with a white background to cover the area, or use the OCR tool in the Converter.',
    replacementText: 'Replacement text',
    addWhiteBgBox: 'Add text box with white background',
    watermarkModalTitle: 'Document Watermark',
    enableWatermark: 'Enable Watermark',
    watermarkTextLabel: 'Watermark Text',
    watermarkPlaceholder: 'e.g. CONFIDENTIAL / ORIGINAL',
    angle: 'Angle',
    apply: 'Apply',
  },
  fr: {
    back: 'Retour',
    pageOf: (p: number, total: number) => `Page ${p} sur ${total}`,
    zoomOut: 'Zoom arrière',
    zoomIn: 'Zoom avant',
    undo: 'Annuler',
    savePage: 'Enregistrer',
    loadingPage: 'Préparation de la page haute résolution...',
    defaultText: 'Écrivez le texte ici',
    emptyText: 'Texte vide',
    textPropsTitle: 'Propriétés du texte',
    deleteText: 'Supprimer le texte',
    closeProps: 'Fermer',
    enterTextPlaceholder: 'Entrez le texte...',
    fontFamily: 'Police',
    fontSans: 'Moderne',
    fontSerif: 'Classique',
    fontMono: 'Mono',
    size: 'Taille',
    lineWidth: 'Largeur',
    bold: 'Gras',
    alignRight: 'Aligner à droite',
    alignCenter: 'Centrer',
    alignLeft: 'Aligner à gauche',
    whiteBgCover: 'Fond blanc pour masquer l’ancien texte',
    editSigProps: 'Taille et position de la signature',
    editImgProps: 'Modifier l’image insérée',
    delete: 'Supprimer',
    opacity: 'Opacité',
    applyToAll: (total: number) => `Appliquer à toutes les pages (${total})`,
    penProps: 'Propriétés du stylo',
    highlightProps: 'Propriétés du surligneur',
    strokeWidth: 'Épaisseur',
    toolMove: 'Déplacer',
    toolAddText: 'Ajouter texte',
    toolEditText: 'Éditer texte',
    toolAddImg: 'Image',
    toolSign: 'Signature',
    toolPen: 'Stylo',
    toolHighlight: 'Surligner',
    toolWatermark: 'Filigrane',
    pickLineTitle: 'Choisissez une ligne à modifier',
    readingText: 'Lecture du texte de la page...',
    noDigitalTextTitle: 'Aucun texte numérique direct trouvé sur cette page.',
    noDigitalTextDesc:
      'Si la page est numérisée comme une image, ajoutez une zone de texte avec fond blanc ou utilisez l’outil OCR.',
    replacementText: 'Texte de remplacement',
    addWhiteBgBox: 'Ajouter un texte avec fond blanc',
    watermarkModalTitle: 'Filigrane du document',
    enableWatermark: 'Activer le filigrane',
    watermarkTextLabel: 'Texte du filigrane',
    watermarkPlaceholder: 'ex. CONFIDENTIEL / ORIGINAL',
    angle: 'Angle',
    apply: 'Appliquer',
  },
  es: {
    back: 'Volver',
    pageOf: (p: number, total: number) => `Página ${p} de ${total}`,
    zoomOut: 'Alejar',
    zoomIn: 'Acercar',
    undo: 'Deshacer',
    savePage: 'Guardar Página',
    loadingPage: 'Preparando página de alta resolución...',
    defaultText: 'Escribe el texto aquí',
    emptyText: 'Texto vacío',
    textPropsTitle: 'Propiedades del texto',
    deleteText: 'Eliminar texto',
    closeProps: 'Cerrar',
    enterTextPlaceholder: 'Introduce el texto...',
    fontFamily: 'Tipo de letra',
    fontSans: 'Moderna',
    fontSerif: 'Clásica',
    fontMono: 'Técnica',
    size: 'Tamaño',
    lineWidth: 'Ancho de línea',
    bold: 'Negrita',
    alignRight: 'Alinear a la derecha',
    alignCenter: 'Centrar',
    alignLeft: 'Alinear a la izquierda',
    whiteBgCover: 'Fondo blanco para cubrir texto antiguo debajo',
    editSigProps: 'Editar tamaño y posición de firma',
    editImgProps: 'Editar imagen insertada',
    delete: 'Eliminar',
    opacity: 'Opacidad',
    applyToAll: (total: number) => `Aplicar a todas las páginas (${total})`,
    penProps: 'Propiedades del lápiz',
    highlightProps: 'Propiedades del resaltador',
    strokeWidth: 'Grosor del trazo',
    toolMove: 'Mover',
    toolAddText: 'Añadir texto',
    toolEditText: 'Editar texto',
    toolAddImg: 'Añadir imagen',
    toolSign: 'Firma',
    toolPen: 'Lápiz',
    toolHighlight: 'Resaltar',
    toolWatermark: 'Marca de agua',
    pickLineTitle: 'Elige una línea para editar y reemplazar',
    readingText: 'Leyendo texto de la página...',
    noDigitalTextTitle: 'No se encontró texto digital directo en esta página.',
    noDigitalTextDesc:
      'Si la página está escaneada como imagen, puedes añadir un cuadro de texto con fondo blanco o usar la herramienta OCR en el Convertidor.',
    replacementText: 'Texto de reemplazo',
    addWhiteBgBox: 'Añadir cuadro de texto con fondo blanco',
    watermarkModalTitle: 'Marca de agua del documento',
    enableWatermark: 'Activar marca de agua',
    watermarkTextLabel: 'Texto de la marca de agua',
    watermarkPlaceholder: 'ej. CONFIDENCIAL / ORIGINAL',
    angle: 'Ángulo',
    apply: 'Aplicar',
  },
};

export const PageAnnotator: React.FC<PageAnnotatorProps> = ({
  sourceBytes,
  page,
  pageNumber,
  totalPages,
  initialAnnotations,
  watermark: initialWatermark,
  currentLang = 'es',
  onSavePage,
  onApplyToAllPages,
  onClose,
}) => {
  const t = translations[currentLang];
  const isRtl = currentLang === 'ar';

  const [pageRender, setPageRender] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [annotations, setAnnotations] = useState<PageAnnotation[]>(initialAnnotations);
  const [tool, setTool] = useState<ActiveTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [penColor, setPenColor] = useState('#0F172A');
  const [highlightColor, setHighlightColor] = useState('#FACC15');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [zoom, setZoom] = useState(1);

  const [watermark, setWatermark] = useState<WatermarkConfig>(initialWatermark);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [showSignatureSheet, setShowSignatureSheet] = useState(false);
  const [showExistingTextSheet, setShowExistingTextSheet] = useState(false);
  const [detectedBlocks, setDetectedBlocks] = useState<DetectedTextBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  const [currentStroke, setCurrentStroke] = useState<StrokeAnnotation | null>(null);
  const [dragState, setDragState] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    renderSinglePdfPage(sourceBytes, page.originalIndex, 2, page.rotation).then((res) => {
      if (active) setPageRender(res);
    });
    return () => {
      active = false;
    };
  }, [sourceBytes, page.originalIndex, page.rotation]);

  const selectedAnnotation = annotations.find((a) => a.id === selectedId) || null;

  const getNormalizedPos = (clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool === 'pen' || tool === 'highlight') {
      e.currentTarget.setPointerCapture(e.pointerId);
      const pt = getNormalizedPos(e.clientX, e.clientY);
      setSelectedId(null);
      setCurrentStroke({
        id: `stroke_${Date.now()}`,
        type: tool,
        color: tool === 'pen' ? penColor : highlightColor,
        width: tool === 'pen' ? strokeWidth : 24,
        points: [pt],
      });
      return;
    }

    if (tool === 'select' && e.target === e.currentTarget) {
      setSelectedId(null);
    }
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (currentStroke) {
      const pt = getNormalizedPos(e.clientX, e.clientY);
      setCurrentStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, pt] } : null
      );
      return;
    }

    if (dragState && stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      const dx = (e.clientX - dragState.startX) / rect.width;
      const dy = (e.clientY - dragState.startY) / rect.height;
      setAnnotations((prev) =>
        prev.map((item) => {
          if (item.id !== dragState.id) return item;
          if (item.type === 'text' || item.type === 'image' || item.type === 'signature') {
            return {
              ...item,
              x: Math.max(0, Math.min(0.9, dragState.origX + dx)),
              y: Math.max(0, Math.min(0.92, dragState.origY + dy)),
            };
          }
          return item;
        })
      );
    }
  };

  const handleStagePointerUp = () => {
    if (currentStroke) {
      if (currentStroke.points.length >= 2) {
        setAnnotations((prev) => [...prev, currentStroke]);
      }
      setCurrentStroke(null);
    }
    setDragState(null);
  };

  const addTextBox = (prefill?: Partial<TextAnnotation>) => {
    const newAnn: TextAnnotation = {
      id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type: 'text',
      text: prefill?.text ?? t.defaultText,
      x: prefill?.x ?? 0.25,
      y: prefill?.y ?? 0.2,
      width: prefill?.width ?? 0.5,
      color: prefill?.color ?? '#0F172A',
      fontFamily: prefill?.fontFamily ?? 'sans',
      fontSize: prefill?.fontSize ?? 28,
      bold: prefill?.bold ?? false,
      align: prefill?.align ?? (isRtl ? 'right' : 'left'),
      backgroundColor: prefill?.backgroundColor ?? 'transparent',
    };
    setAnnotations((prev) => [...prev, newAnn]);
    setSelectedId(newAnn.id);
    setTool('select');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const aspect = (img.naturalHeight || 1) / (img.naturalWidth || 1);
        const w = 0.36;
        const pageAspect = pageRender ? pageRender.width / pageRender.height : 0.707;
        const h = Math.min(0.6, w * aspect * pageAspect);
        const newImg: ImageAnnotation = {
          id: `img_${Date.now()}`,
          type: 'image',
          dataUrl,
          x: 0.32,
          y: 0.3,
          width: w,
          height: h,
          opacity: 1,
        };
        setAnnotations((prev) => [...prev, newImg]);
        setSelectedId(newImg.id);
        setTool('select');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleInsertSignature = (dataUrl: string) => {
    const newSig: ImageAnnotation = {
      id: `sig_${Date.now()}`,
      type: 'signature',
      dataUrl,
      x: 0.32,
      y: 0.72,
      width: 0.32,
      height: 0.11,
      opacity: 1,
    };
    setAnnotations((prev) => [...prev, newSig]);
    setSelectedId(newSig.id);
    setTool('select');
  };

  const openExistingTextPicker = async () => {
    setShowExistingTextSheet(true);
    setLoadingBlocks(true);
    try {
      const blocks = await extractPageTextBlocks(sourceBytes, page.originalIndex);
      setDetectedBlocks(blocks);
    } catch {
      setDetectedBlocks([]);
    } finally {
      setLoadingBlocks(false);
    }
  };

  const updateSelectedText = (patch: Partial<TextAnnotation>) => {
    if (!selectedId) return;
    setAnnotations((prev) =>
      prev.map((a) => (a.id === selectedId && a.type === 'text' ? { ...a, ...patch } : a))
    );
  };

  const updateSelectedImage = (patch: Partial<ImageAnnotation>) => {
    if (!selectedId) return;
    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === selectedId && (a.type === 'image' || a.type === 'signature')
          ? { ...a, ...patch }
          : a
      )
    );
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  };

  const handleUndo = () => {
    setAnnotations((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.id === selectedId) setSelectedId(null);
      return prev.slice(0, -1);
    });
  };

  const renderFontFamilyCss = (family: TextFontFamily) => {
    if (family === 'serif') return 'Georgia, "Times New Roman", serif';
    if (family === 'mono') return '"JetBrains Mono", monospace';
    return '"IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif';
  };

  const allStrokes = [
    ...annotations.filter((a): a is StrokeAnnotation => a.type === 'pen' || a.type === 'highlight'),
    ...(currentStroke ? [currentStroke] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-[54px] bg-white border-b border-slate-200 px-3 md:px-6 flex items-center justify-between gap-2 shrink-0 pt-safe">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label={t.back}
          >
            <ArrowRight className={`w-5 h-5 ${!isRtl ? 'rotate-180' : ''}`} />
          </button>
          <span className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
            {t.pageOf(pageNumber, totalPages)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
            aria-label={t.zoomOut}
            className="hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, Number((z + 0.25).toFixed(2))))}
            aria-label={t.zoomIn}
            className="hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={annotations.length === 0}
            aria-label={t.undo}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onSavePage(page.id, annotations, watermark)}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-[0.98] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            <span>{t.savePage}</span>
          </button>
        </div>
      </header>

      {/* Main Split Area: Canvas + Desktop Inspector */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Scrollable PDF Page Canvas */}
        <div className="flex-1 overflow-auto p-3 md:p-6 flex items-start justify-center">
          {!pageRender ? (
            <div className="w-full max-w-md aspect-[3/4] bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-sm text-slate-500">
              {t.loadingPage}
            </div>
          ) : (
            <div
              ref={stageRef}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
              onPointerCancel={handleStagePointerUp}
              style={{
                width: `${Math.round(540 * zoom)}px`,
                maxWidth: zoom <= 1 ? '100%' : 'none',
                aspectRatio: `${pageRender.width} / ${pageRender.height}`,
              }}
              className={`relative bg-white shadow-md border border-slate-200 rounded-lg overflow-hidden select-none shrink-0 ${
                tool === 'pen' || tool === 'highlight'
                  ? 'touch-none cursor-crosshair'
                  : 'cursor-default'
              }`}
            >
              <img
                src={pageRender.dataUrl}
                alt={`Page ${pageNumber}`}
                draggable={false}
                className="w-full h-full object-contain pointer-events-none select-none"
              />

              {/* SVG Layer for Freehand Pen & Highlighter */}
              <svg
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                {allStrokes.map((s) => {
                  const d = s.points
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * 1000} ${p.y * 1000}`)
                    .join(' ');
                  return (
                    <path
                      key={s.id}
                      d={d}
                      fill="none"
                      stroke={s.color}
                      strokeOpacity={s.type === 'highlight' ? 0.36 : 1}
                      strokeWidth={s.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
              </svg>

              {/* Watermark Live Preview */}
              {watermark.enabled && watermark.text.trim() && (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
                  style={{ opacity: watermark.opacity }}
                >
                  <span
                    className="font-bold text-3xl md:text-5xl whitespace-nowrap"
                    style={{
                      color: watermark.color,
                      transform: `rotate(${watermark.angle}deg)`,
                    }}
                  >
                    {watermark.text}
                  </span>
                </div>
              )}

              {/* Inserted Images & Signatures */}
              {annotations
                .filter((a): a is ImageAnnotation => a.type === 'image' || a.type === 'signature')
                .map((imgAnn) => {
                  const isSelected = selectedId === imgAnn.id;
                  return (
                    <div
                      key={imgAnn.id}
                      onPointerDown={(e) => {
                        if (tool !== 'select') return;
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setSelectedId(imgAnn.id);
                        setDragState({
                          id: imgAnn.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          origX: imgAnn.x,
                          origY: imgAnn.y,
                        });
                      }}
                      style={{
                        left: `${imgAnn.x * 100}%`,
                        top: `${imgAnn.y * 100}%`,
                        width: `${imgAnn.width * 100}%`,
                        height: `${imgAnn.height * 100}%`,
                        opacity: imgAnn.opacity ?? 1,
                      }}
                      className={`absolute touch-none cursor-move rounded transition-shadow ${
                        isSelected
                          ? 'ring-2 ring-red-600 bg-red-50/10'
                          : 'hover:ring-1 hover:ring-slate-400'
                      }`}
                    >
                      <img
                        src={imgAnn.dataUrl}
                        alt={imgAnn.type}
                        draggable={false}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </div>
                  );
                })}

              {/* Editable Text Annotations */}
              {annotations
                .filter((a): a is TextAnnotation => a.type === 'text')
                .map((txt) => {
                  const isSelected = selectedId === txt.id;
                  const stageWidth = stageRef.current?.clientWidth || 540;
                  const scaledPx = Math.max(10, (txt.fontSize / 1000) * stageWidth);
                  return (
                    <div
                      key={txt.id}
                      onPointerDown={(e) => {
                        if (tool !== 'select') return;
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setSelectedId(txt.id);
                        setDragState({
                          id: txt.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          origX: txt.x,
                          origY: txt.y,
                        });
                      }}
                      style={{
                        left: `${txt.x * 100}%`,
                        top: `${txt.y * 100}%`,
                        width: `${(txt.width || 0.45) * 100}%`,
                        color: txt.color,
                        fontFamily: renderFontFamilyCss(txt.fontFamily),
                        fontSize: `${scaledPx}px`,
                        fontWeight: txt.bold ? 700 : 500,
                        textAlign: txt.align,
                        backgroundColor:
                          txt.backgroundColor === '#FFFFFF' ? '#FFFFFF' : 'transparent',
                        lineHeight: 1.38,
                      }}
                      className={`absolute touch-none cursor-move px-1.5 py-0.5 rounded whitespace-pre-wrap break-words ${
                        isSelected
                          ? 'ring-2 ring-red-600'
                          : 'ring-1 ring-dashed ring-slate-300/80 hover:ring-slate-500'
                      }`}
                    >
                      {txt.text || t.emptyText}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Contextual Properties Panel */}
        {(selectedAnnotation || tool === 'pen' || tool === 'highlight') && (
          <aside className="lg:w-80 bg-white border-t lg:border-t-0 lg:border-r border-slate-200 p-4 overflow-y-auto max-h-[38vh] lg:max-h-none shrink-0 space-y-4">
            {selectedAnnotation?.type === 'text' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{t.textPropsTitle}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={deleteSelected}
                      aria-label={t.deleteText}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      aria-label={t.closeProps}
                      className="lg:hidden min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={selectedAnnotation.text}
                  onChange={(e) => updateSelectedText({ text: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-red-600"
                  placeholder={t.enterTextPlaceholder}
                />

                {/* Font Family */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    {t.fontFamily}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                    {[
                      { id: 'sans' as const, label: t.fontSans },
                      { id: 'serif' as const, label: t.fontSerif },
                      { id: 'mono' as const, label: t.fontMono },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => updateSelectedText({ fontFamily: f.id })}
                        className={`min-h-[36px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          selectedAnnotation.fontFamily === f.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size & Box Width */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{t.size}</span>
                      <span className="font-mono-num font-semibold">
                        {selectedAnnotation.fontSize}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={14}
                      max={72}
                      value={selectedAnnotation.fontSize}
                      onChange={(e) =>
                        updateSelectedText({ fontSize: Number(e.target.value) })
                      }
                      className="w-full accent-red-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{t.lineWidth}</span>
                      <span className="font-mono-num font-semibold">
                        {Math.round((selectedAnnotation.width || 0.45) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={95}
                      value={Math.round((selectedAnnotation.width || 0.45) * 100)}
                      onChange={(e) =>
                        updateSelectedText({ width: Number(e.target.value) / 100 })
                      }
                      className="w-full accent-red-600"
                    />
                  </div>
                </div>

                {/* Colors + Style */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    {COLOR_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateSelectedText({ color: c })}
                        aria-label={c}
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                          selectedAnnotation.color === c
                            ? 'border-slate-900 scale-110'
                            : 'border-slate-200'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateSelectedText({ bold: !selectedAnnotation.bold })}
                      aria-label={t.bold}
                      className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border cursor-pointer ${
                        selectedAnnotation.bold
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedText({ align: 'right' })}
                      aria-label={t.alignRight}
                      className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border cursor-pointer ${
                        selectedAnnotation.align === 'right'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedText({ align: 'center' })}
                      aria-label={t.alignCenter}
                      className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border cursor-pointer ${
                        selectedAnnotation.align === 'center'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedText({ align: 'left' })}
                      aria-label={t.alignLeft}
                      className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border cursor-pointer ${
                        selectedAnnotation.align === 'left'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAnnotation.backgroundColor === '#FFFFFF'}
                    onChange={(e) =>
                      updateSelectedText({
                        backgroundColor: e.target.checked ? '#FFFFFF' : 'transparent',
                      })
                    }
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                  <span>{t.whiteBgCover}</span>
                </label>
              </div>
            )}

            {(selectedAnnotation?.type === 'image' ||
              selectedAnnotation?.type === 'signature') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">
                    {selectedAnnotation.type === 'signature'
                      ? t.editSigProps
                      : t.editImgProps}
                  </span>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="min-h-[36px] px-2.5 flex items-center gap-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t.delete}</span>
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>{t.size}</span>
                    <span className="font-mono-num font-semibold">
                      {Math.round(selectedAnnotation.width * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={90}
                    value={Math.round(selectedAnnotation.width * 100)}
                    onChange={(e) => {
                      const nextW = Number(e.target.value) / 100;
                      const ratio = selectedAnnotation.height / selectedAnnotation.width;
                      updateSelectedImage({ width: nextW, height: nextW * ratio });
                    }}
                    className="w-full accent-red-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>{t.opacity}</span>
                    <span className="font-mono-num font-semibold">
                      {Math.round((selectedAnnotation.opacity ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={100}
                    value={Math.round((selectedAnnotation.opacity ?? 1) * 100)}
                    onChange={(e) =>
                      updateSelectedImage({ opacity: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-red-600"
                  />
                </div>

                {onApplyToAllPages && totalPages > 1 && (
                  <button
                    type="button"
                    onClick={() => onApplyToAllPages(selectedAnnotation)}
                    className="w-full min-h-[40px] px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                  >
                    {t.applyToAll(totalPages)}
                  </button>
                )}
              </div>
            )}

            {!selectedAnnotation && (tool === 'pen' || tool === 'highlight') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">
                    {tool === 'pen' ? t.penProps : t.highlightProps}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(tool === 'pen' ? COLOR_SWATCHES : HIGHLIGHT_SWATCHES).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          tool === 'pen' ? setPenColor(c) : setHighlightColor(c)
                        }
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                          (tool === 'pen' ? penColor : highlightColor) === c
                            ? 'border-slate-900 scale-110'
                            : 'border-slate-200'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                {tool === 'pen' && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{t.strokeWidth}</span>
                      <span className="font-mono-num">{strokeWidth}</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={16}
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      className="w-full accent-red-600"
                    />
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Thumb-Zone Editing Toolbar */}
      <div className="bg-white border-t border-slate-200 px-2 py-2 pb-safe shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between sm:justify-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setTool('select')}
            className={`min-h-[48px] min-w-[60px] px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer transition-colors ${
              tool === 'select'
                ? 'bg-red-50 text-red-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MousePointer className="w-5 h-5" />
            <span>{t.toolMove}</span>
          </button>

          <button
            type="button"
            onClick={() => addTextBox()}
            className="min-h-[48px] min-w-[60px] px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer text-slate-700 hover:bg-slate-100"
          >
            <TypeIcon className="w-5 h-5" />
            <span>{t.toolAddText}</span>
          </button>

          <button
            type="button"
            onClick={openExistingTextPicker}
            className="min-h-[48px] min-w-[68px] px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer text-slate-700 hover:bg-slate-100"
          >
            <Replace className="w-5 h-5" />
            <span>{t.toolEditText}</span>
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="min-h-[48px] min-w-[64px] px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer text-slate-700 hover:bg-slate-100"
          >
            <ImagePlus className="w-5 h-5" />
            <span>{t.toolAddImg}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSignatureSheet(true)}
            className="min-h-[48px] min-w-[60px] px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer text-slate-700 hover:bg-slate-100"
          >
            <PenTool className="w-5 h-5" />
            <span>{t.toolSign}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setTool('pen');
            }}
            className={`min-h-[48px] min-w-[56px] px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer transition-colors ${
              tool === 'pen'
                ? 'bg-red-50 text-red-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Pen className="w-5 h-5" />
            <span>{t.toolPen}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setTool('highlight');
            }}
            className={`min-h-[48px] min-w-[56px] px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer transition-colors ${
              tool === 'highlight'
                ? 'bg-amber-50 text-amber-800'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Highlighter className="w-5 h-5" />
            <span>{t.toolHighlight}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWatermarkModal(true)}
            className={`min-h-[48px] min-w-[68px] px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer transition-colors ${
              watermark.enabled
                ? 'bg-red-50 text-red-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Stamp className="w-5 h-5" />
            <span>{t.toolWatermark}</span>
          </button>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <SignatureSheet
        open={showSignatureSheet}
        onClose={() => setShowSignatureSheet(false)}
        onInsertSignature={handleInsertSignature}
      />

      {/* Existing PDF Text Picker Sheet */}
      {showExistingTextSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center"
          onClick={() => setShowExistingTextSheet(false)}
        >
          <div
            className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-2xl max-h-[82vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-3" />
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {t.pickLineTitle}
              </h3>
              <button
                type="button"
                onClick={() => setShowExistingTextSheet(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
              {loadingBlocks ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  {t.readingText}
                </p>
              ) : detectedBlocks.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm text-slate-700 font-medium">
                    {t.noDigitalTextTitle}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t.noDigitalTextDesc}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExistingTextSheet(false);
                      addTextBox({ backgroundColor: '#FFFFFF', text: t.replacementText });
                    }}
                    className="mt-2 min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium cursor-pointer"
                  >
                    {t.addWhiteBgBox}
                  </button>
                </div>
              ) : (
                detectedBlocks.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setShowExistingTextSheet(false);
                      addTextBox({
                        text: b.text,
                        x: b.x,
                        y: b.y,
                        width: b.width,
                        fontSize: b.fontSize,
                        backgroundColor: '#FFFFFF',
                      });
                    }}
                    className={`w-full ${isRtl ? 'text-right' : 'text-left'} p-3 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50/30 transition-colors cursor-pointer`}
                  >
                    <p className="text-sm text-slate-900 line-clamp-2">{b.text}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Watermark Modal */}
      {showWatermarkModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center"
          onClick={() => setShowWatermarkModal(false)}
        >
          <div
            className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{t.watermarkModalTitle}</h3>
              <button
                type="button"
                onClick={() => setShowWatermarkModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <span className="text-sm font-medium text-slate-800">{t.enableWatermark}</span>
              <input
                type="checkbox"
                checked={watermark.enabled}
                onChange={(e) =>
                  setWatermark((w) => ({ ...w, enabled: e.target.checked }))
                }
                className="w-5 h-5 accent-red-600"
              />
            </label>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t.watermarkTextLabel}
              </label>
              <input
                type="text"
                value={watermark.text}
                onChange={(e) =>
                  setWatermark((w) => ({ ...w, text: e.target.value, enabled: true }))
                }
                placeholder={t.watermarkPlaceholder}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{t.opacity}</span>
                  <span className="font-mono-num">{Math.round(watermark.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  value={Math.round(watermark.opacity * 100)}
                  onChange={(e) =>
                    setWatermark((w) => ({ ...w, opacity: Number(e.target.value) / 100 }))
                  }
                  className="w-full accent-red-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{t.angle}</span>
                  <span className="font-mono-num">{watermark.angle}°</span>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={watermark.angle}
                  onChange={(e) =>
                    setWatermark((w) => ({ ...w, angle: Number(e.target.value) }))
                  }
                  className="w-full accent-red-600"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowWatermarkModal(false)}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer"
            >
              {t.apply}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
