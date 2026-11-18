import React from 'react';
import {
  Camera,
  FileText,
  ImagePlus,
  Layers,
  Minimize2,
  PenLine,
  ScanText,
  Scissors,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { ConvertMode, EditMode, StoredPdfFile } from '../types/pdf';
import { formatBytes, formatRelativeTime } from '../utils/pdfEngine';

interface HomeHubProps {
  recentFiles: StoredPdfFile[];
  currentLang: 'ar' | 'en' | 'fr' | 'es';
  onPickPdf: () => void;
  onLoadSamplePdf: () => void;
  onStartConvert: (mode: ConvertMode) => void;
  onStartEdit: (mode: EditMode) => void;
  onOpenRecentFile: (file: StoredPdfFile) => void;
}

const translations = {
  ar: {
    badge: 'استوديو PDF متكامل يعمل بالكامل على هاتفك',
    title: 'حرّر، امسح بالكاميرا، وحوّل مستنداتك بلمسة واحدة',
    desc: 'صوّر أوراقك بكاميرا الهاتف وحوّلها لملف PDF احترافي، أو عدّل نصوص ومستندات PDF وأضف توقيعك واستخرج النصوص بسرعة وخصوصية تامة.',
    pickPdf: 'اختيار ملف PDF',
    cameraScan: 'سكان بالكاميرا',
    ocrScan: 'مسح ضوئي OCR',
    sampleTry: 'تجربة بملف جاهز',
    dropBox: 'اضغط لرفع ملف PDF أو اسحبه هنا',
    dropDesc: 'دعم كامل للغات العربية، الإنجليزية، الفرنسية والإسبانية دون إنترنت',
    quickTools: 'الأدوات السريعة',
    compress: 'ضغط الحجم',
    recentFiles: 'أحدث الملفات',
    open: 'فتح',
    pagesCount: 'صفحات',
    devAr: 'تطوير: عبد القادر العواد الحيمودي',
    devEn: 'Developed by Abdelkader El aouad El haimoudi',
    tools: [
      {
        title: 'مسح بالكاميرا (Scan to PDF)',
        desc: 'صوّر المستندات والوثائق الورقية بكاميرا الهاتف وحوّلها فوراً إلى PDF واضح ومقروء.',
      },
      {
        title: 'تعديل النصوص والصفحات',
        desc: 'عدّل النصوص وخطوطها وألوانها، أدرج صوراً وتوقيعاً، ورتب أو احذف الصفحات.',
      },
      {
        title: 'التعرف الضوئي (OCR)',
        desc: 'استخرج النصوص متعددة اللغات من الصور وملفات PDF الممسوحة واجعلها قابلة للبحث.',
      },
      {
        title: 'صور إلى PDF',
        desc: 'حوّل صور الهاتف إلى مستند PDF منسق بمقاس A4 أو بالحجم الأصلي.',
      },
      {
        title: 'دمج ملفات PDF',
        desc: 'اجمع عدة مستندات PDF في ملف واحد بالترتيب الذي تختاره.',
      },
      {
        title: 'تقسيم واستخراج',
        desc: 'استخرج صفحات محددة أو افصل كل صفحة في ملف مستقل داخل حزمة ZIP.',
      },
      {
        title: 'PDF إلى Word أو صور',
        desc: 'حوّل المستند إلى صور PNG/JPG عالية الدقة أو ملف قابل للتحرير.',
      },
    ],
  },
  en: {
    badge: 'Complete PDF studio working fully on your phone',
    title: 'Edit, scan, and convert your documents in one touch',
    desc: 'Capture paperwork with your phone camera into a professional PDF, edit PDF texts, add your signature, and extract text securely.',
    pickPdf: 'Choose PDF file',
    cameraScan: 'Camera Scan',
    ocrScan: 'OCR Scan',
    sampleTry: 'Try sample file',
    dropBox: 'Click to upload PDF or drag here',
    dropDesc: 'Full offline support for Arabic, English, French and Spanish',
    quickTools: 'Quick Tools',
    compress: 'Compress',
    recentFiles: 'Recent Files',
    open: 'Open',
    pagesCount: 'pages',
    devAr: 'تطوير: عبد القادر العواد الحيمودي',
    devEn: 'Developed by Abdelkader El aouad El haimoudi',
    tools: [
      {
        title: 'Scan to PDF',
        desc: 'Capture physical documents with your phone camera into clear PDFs.',
      },
      {
        title: 'Edit Text & Pages',
        desc: 'Edit texts, fonts, colors, insert images, signatures, and manage pages.',
      },
      {
        title: 'OCR Text Recognition',
        desc: 'Extract multilingual text from images and scanned PDFs easily.',
      },
      {
        title: 'Images to PDF',
        desc: 'Convert phone images into formatted A4 or original size PDF documents.',
      },
      {
        title: 'Merge PDFs',
        desc: 'Combine multiple PDF documents into a single file in your preferred order.',
      },
      {
        title: 'Split & Extract',
        desc: 'Extract specific pages or split each page into a separate file in a ZIP.',
      },
      {
        title: 'PDF to Word or Images',
        desc: 'Convert your document into high-res PNG/JPG images or editable files.',
      },
    ],
  },
  fr: {
    badge: 'Studio PDF complet fonctionnant entièrement sur votre téléphone',
    title: 'Éditez, scannez et convertissez vos documents en un geste',
    desc: 'Photographiez vos documents avec votre téléphone en PDF professionnel, modifiez les textes, signez et extrayez du texte en toute sécurité.',
    pickPdf: 'Choisir un PDF',
    cameraScan: 'Scan Caméra',
    ocrScan: 'Scan OCR',
    sampleTry: 'Essayer un exemple',
    dropBox: 'Cliquez pour téléverser un PDF ou glissez-le ici',
    dropDesc: 'Support complet hors ligne pour arabe, anglais, français et espagnol',
    quickTools: 'Outils rapides',
    compress: 'Compresser',
    recentFiles: 'Fichiers récents',
    open: 'Ouvrir',
    pagesCount: 'pages',
    devAr: 'تطوير: عبد القادر العواد الحيمودي',
    devEn: 'Developed by Abdelkader El aouad El haimoudi',
    tools: [
      {
        title: 'Scanner en PDF',
        desc: 'Capturez des documents papier avec votre caméra en PDF clairs.',
      },
      {
        title: 'Éditer Texte & Pages',
        desc: 'Modifiez textes, polices, couleurs, insérez des signatures et gérez les pages.',
      },
      {
        title: 'Reconnaissance OCR',
        desc: 'Extrayez du texte multilingue à partir d’images et de PDF scannés.',
      },
      {
        title: 'Images vers PDF',
        desc: 'Convertissez des images en documents PDF formatés A4 ou taille d’origine.',
      },
      {
        title: 'Fusionner des PDF',
        desc: 'Combinez plusieurs documents PDF en un seul fichier dans l’ordre voulu.',
      },
      {
        title: 'Diviser & Extraire',
        desc: 'Extrayez des pages spécifiques ou séparez chaque page dans un fichier ZIP.',
      },
      {
        title: 'PDF vers Word ou Images',
        desc: 'Convertissez votre document en images PNG/JPG haute résolution.',
      },
    ],
  },
  es: {
    badge: 'Estudio PDF completo que funciona totalmente en tu teléfono',
    title: 'Edita, escanea y convierte tus documentos con un solo toque',
    desc: 'Captura documentos con la cámara de tu teléfono en un PDF profesional, edita textos, añade tu firma y extrae texto de forma segura.',
    pickPdf: 'Elegir archivo PDF',
    cameraScan: 'Escanear',
    ocrScan: 'Escaneo OCR',
    sampleTry: 'Probar muestra',
    dropBox: 'Haz clic para subir un PDF o arrástralo aquí',
    dropDesc: 'Soporte completo sin conexión para árabe, inglés, francés y español',
    quickTools: 'Herramientas rápidas',
    compress: 'Comprimir',
    recentFiles: 'Archivos recientes',
    open: 'Abrir',
    pagesCount: 'páginas',
    devAr: 'تطوير: عبد القادر العواد الحيمودي',
    devEn: 'Developed by Abdelkader El aouad El haimoudi',
    tools: [
      {
        title: 'Escanear a PDF',
        desc: 'Captura documentos físicos con la cámara en PDFs claros y legibles.',
      },
      {
        title: 'Editar Textos y Páginas',
        desc: 'Edita textos, fuentes, colores, inserta firmas y organiza páginas.',
      },
      {
        title: 'Reconocimiento OCR',
        desc: 'Extrae texto multilingüe de imágenes y PDFs escaneados fácilmente.',
      },
      {
        title: 'Imágenes a PDF',
        desc: 'Convierte imágenes del teléfono en documentos PDF formateados.',
      },
      {
        title: 'Unir PDFs',
        desc: 'Combina varios documentos PDF en un solo archivo en el orden deseado.',
      },
      {
        title: 'Dividir y Extraer',
        desc: 'Extrae páginas específicas o separa cada página en un archivo ZIP.',
      },
      {
        title: 'PDF a Word o Imágenes',
        desc: 'Convierte tu documento en imágenes PNG/JPG de alta resolución.',
      },
    ],
  },
};

export const HomeHub: React.FC<HomeHubProps> = ({
  recentFiles,
  currentLang,
  onPickPdf,
  onLoadSamplePdf,
  onStartConvert,
  onStartEdit,
  onOpenRecentFile,
}) => {
  const t = translations[currentLang];

  const toolsConfig = [
    {
      icon: Camera,
      accent: 'bg-rose-50 text-rose-600',
      onClick: () => onStartConvert('img-to-pdf'),
    },
    {
      icon: PenLine,
      accent: 'bg-red-50 text-red-600',
      onClick: () => onStartEdit('pages'),
    },
    {
      icon: ScanText,
      accent: 'bg-amber-50 text-amber-700',
      onClick: () => onStartConvert('ocr'),
    },
    {
      icon: ImagePlus,
      accent: 'bg-sky-50 text-sky-700',
      onClick: () => onStartConvert('img-to-pdf'),
    },
    {
      icon: Layers,
      accent: 'bg-emerald-50 text-emerald-700',
      onClick: () => onStartEdit('merge'),
    },
    {
      icon: Scissors,
      accent: 'bg-violet-50 text-violet-700',
      onClick: () => onStartEdit('split'),
    },
    {
      icon: FileText,
      accent: 'bg-slate-100 text-slate-700',
      onClick: () => onStartConvert('pdf-to-word'),
    },
  ];

  const tools = t.tools.map((item, index) => ({
    ...item,
    ...toolsConfig[index],
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-24 md:pb-12 space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-red-950 text-white p-6 md:p-10 shadow-lg border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        <div className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full bg-red-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative lg:col-span-7 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-red-200">
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span>{t.badge}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
            {t.title}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
            {t.desc}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onPickPdf}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-red-950/50"
            >
              <Upload className="w-4 h-4" />
              <span>{t.pickPdf}</span>
            </button>
            <button
              type="button"
              onClick={() => onStartConvert('img-to-pdf')}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-white/15 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 text-rose-300" />
              <span>{t.cameraScan}</span>
            </button>
            <button
              type="button"
              onClick={() => onStartConvert('ocr')}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ScanText className="w-4 h-4 text-amber-300" />
              <span>{t.ocrScan}</span>
            </button>
            <button
              type="button"
              onClick={onLoadSamplePdf}
              className="min-h-[48px] px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            >
              {t.sampleTry}
            </button>
          </div>
        </div>

        <div className="relative lg:col-span-5">
          <button
            type="button"
            onClick={onPickPdf}
            className="w-full rounded-2xl border-2 border-dashed border-white/20 hover:border-red-400 bg-white/5 hover:bg-white/10 backdrop-blur-xs p-6 md:p-8 flex flex-col items-center justify-center text-center gap-3 transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white shadow-lg shadow-red-950/60 group-hover:scale-105 transition-transform">
              <FileText className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">
                {t.dropBox}
              </p>
              <p className="text-xs text-slate-400">
                {t.dropDesc}
              </p>
            </div>
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{t.quickTools}</h2>
          <button
            type="button"
            onClick={() => onStartEdit('compress')}
            className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 flex items-center gap-1.5 cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>{t.compress}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.title}
                type="button"
                onClick={tool.onClick}
                className={`bg-white rounded-2xl border border-slate-200 p-5 ${currentLang === 'ar' ? 'text-right' : 'text-left'} hover:border-slate-300 hover:shadow-xs active:scale-[0.99] transition-all flex items-start gap-4 cursor-pointer`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tool.accent}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm md:text-base font-bold text-slate-900">
                    {tool.title}
                  </h3>
                  <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                    {tool.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {recentFiles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">{t.recentFiles}</h2>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {recentFiles.slice(0, 4).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onOpenRecentFile(f)}
                className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 ${currentLang === 'ar' ? 'text-right' : 'text-left'} hover:bg-slate-50 transition-colors cursor-pointer`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {f.name}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {f.actionLabel} · {f.pageCount} {t.pagesCount} ·{' '}
                      <span className="font-mono-num">{formatBytes(f.size)}</span> ·{' '}
                      {formatRelativeTime(f.updatedAt)}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-red-600 shrink-0">
                  {t.open}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="pt-4 pb-2 text-center border-t border-slate-200/70 space-y-1">
        <p className="text-xs font-semibold text-slate-700">
          {t.devAr}
        </p>
        <p className="text-[11px] text-slate-500 font-medium" dir="ltr">
          {t.devEn}
        </p>
      </footer>
    </div>
  );
};
