import React from 'react';
import {
  FileText,
  ImagePlus,
  Layers,
  Minimize2,
  PenLine,
  ScanText,
  Scissors,
  Upload,
  Package,
} from 'lucide-react';
import type { ConvertMode, EditMode, StoredPdfFile } from '../types/pdf';
import { formatBytes, formatRelativeTime } from '../utils/pdfEngine';
import { PWAInstallButton } from './PWAInstallButton';

interface HomeHubProps {
  recentFiles: StoredPdfFile[];
  onPickPdf: () => void;
  onLoadSamplePdf: () => void;
  onStartConvert: (mode: ConvertMode) => void;
  onStartEdit: (mode: EditMode) => void;
  onOpenRecentFile: (file: StoredPdfFile) => void;
}

export const HomeHub: React.FC<HomeHubProps> = ({
  recentFiles,
  onPickPdf,
  onLoadSamplePdf,
  onStartConvert,
  onStartEdit,
  onOpenRecentFile,
}) => {
  const tools = [
    {
      title: 'تعديل النصوص والصفحات',
      desc: 'عدّل النصوص وخطوطها وألوانها، أدرج صوراً وتوقيعاً، ورتب أو احذف الصفحات.',
      icon: PenLine,
      accent: 'bg-red-50 text-red-600',
      onClick: () => onStartEdit('pages'),
    },
    {
      title: 'التعرف الضوئي (OCR)',
      desc: 'استخرج النصوص العربية والإنجليزية من الصور وملفات PDF الممسوحة واجعلها قابلة للبحث.',
      icon: ScanText,
      accent: 'bg-amber-50 text-amber-700',
      onClick: () => onStartConvert('ocr'),
    },
    {
      title: 'صور إلى PDF',
      desc: 'حوّل صور الهاتف أو مسح الكاميرا إلى مستند PDF منسق بمقاس A4.',
      icon: ImagePlus,
      accent: 'bg-sky-50 text-sky-700',
      onClick: () => onStartConvert('img-to-pdf'),
    },
    {
      title: 'دمج ملفات PDF',
      desc: 'اجمع عدة مستندات PDF في ملف واحد بالترتيب الذي تختاره.',
      icon: Layers,
      accent: 'bg-emerald-50 text-emerald-700',
      onClick: () => onStartEdit('merge'),
    },
    {
      title: 'تقسيم واستخراج',
      desc: 'استخرج صفحات محددة أو افصل كل صفحة في ملف مستقل داخل حزمة ZIP.',
      icon: Scissors,
      accent: 'bg-violet-50 text-violet-700',
      onClick: () => onStartEdit('split'),
    },
    {
      title: 'PDF إلى Word أو صور',
      desc: 'حوّل المستند إلى صور PNG/JPG عالية الدقة أو ملف Word قابل للتحرير.',
      icon: FileText,
      accent: 'bg-slate-100 text-slate-700',
      onClick: () => onStartConvert('pdf-to-word'),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-24 md:pb-12 space-y-8">
      {/* Hero Intake Section */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        <div className="lg:col-span-7 space-y-4">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
            تحويل وتعديل ملفات PDF بسهولة كاملة من هاتفك
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
            افتح أي مستند لتعديل نصوصه، إدراج الصور والتوقيع، إعادة ترتيب الصفحات، أو استخراج النصوص بالمسح الضوئي (OCR) مباشرة دون تعقيد.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onPickPdf}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>اختيار ملف PDF</span>
            </button>
            <button
              type="button"
              onClick={() => onStartConvert('ocr')}
              className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
            >
              <ScanText className="w-4 h-4 text-red-600" />
              <span>مسح ضوئي OCR</span>
            </button>
            <button
              type="button"
              onClick={onLoadSamplePdf}
              className="min-h-[48px] px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              تجربة بملف جاهز
            </button>
          </div>
        </div>

        {/* Quick Touch Drop Box */}
        <div className="lg:col-span-5">
          <button
            type="button"
            onClick={onPickPdf}
            className="w-full rounded-2xl border-2 border-dashed border-slate-200 hover:border-red-400 bg-slate-50/70 p-6 md:p-8 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-red-600 shadow-xs">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                اضغط لرفع ملف PDF أو اسحبه هنا
              </p>
              <p className="text-xs text-slate-500">
                المعالجة تتم محلياً وبسرعة على جهازك
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Core Tools Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">الأدوات السريعة</h2>
          <button
            type="button"
            onClick={() => onStartEdit('compress')}
            className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 flex items-center gap-1.5 cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>ضغط الحجم</span>
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
                className="bg-white rounded-2xl border border-slate-200 p-5 text-right hover:border-slate-300 active:scale-[0.99] transition-all flex items-start gap-4 cursor-pointer"
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

      {/* Recent Local Files */}
      {recentFiles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">أحدث الملفات</h2>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {recentFiles.slice(0, 4).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onOpenRecentFile(f)}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-right hover:bg-slate-50 transition-colors cursor-pointer"
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
                      {f.actionLabel} · {f.pageCount} صفحات ·{' '}
                      <span className="font-mono-num">{formatBytes(f.size)}</span> ·{' '}
                      {formatRelativeTime(f.updatedAt)}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-red-600 shrink-0">
                  فتح
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Mobile App & APK Export */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            تثبيت على الهاتف أو بناء APK عبر GitHub
          </h2>
          <p className="text-xs md:text-sm text-slate-500">
            حمّل أرشيف المستودع الجاهز مع ملف أتمتة GitHub Actions و Capacitor لتوليد ملف APK تلقائياً عند رفعه إلى GitHub.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <PWAInstallButton />
          <a
            href="/api/export-apk-archive"
            download="waraqa-pdf-github-apk.zip"
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs md:text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap"
          >
            <Package className="w-4 h-4 text-red-600" />
            <span>تنزيل أرشيف GitHub APK (.zip)</span>
          </a>
        </div>
      </section>

      {/* Developer Credits */}
      <footer className="pt-4 pb-2 text-center border-t border-slate-200/70 space-y-1">
        <p className="text-xs font-semibold text-slate-700">
          تطوير: عبد القادر العواد الحيمودي
        </p>
        <p className="text-[11px] text-slate-500 font-medium" dir="ltr">
          Developed by Abdelkader El aouad El haimoudi
        </p>
      </footer>
    </div>
  );
};
