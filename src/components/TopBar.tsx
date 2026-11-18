import React from 'react';
import { ArrowRight, FilePlus2, Globe } from 'lucide-react';
import type { AppSection } from '../types/pdf';

interface TopBarProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  onOpenFilePicker: () => void;
  currentLang: 'ar' | 'en' | 'fr' | 'es';
  onLanguageChange: (lang: 'ar' | 'en' | 'fr' | 'es') => void;
  subViewTitle?: string;
  onBackFromSubView?: () => void;
}

// ترجمات عناصر التنقل للغات الأربع
const navLabels = {
  ar: { home: 'الرئيسية', convert: 'المحول', edit: 'المحرر', files: 'ملفاتي', openPdf: 'فتح ملف PDF', newFile: 'ملف جديد' },
  en: { home: 'Home', convert: 'Converter', edit: 'Editor', files: 'My Files', openPdf: 'Open PDF', newFile: 'New File' },
  fr: { home: 'Accueil', convert: 'Convertisseur', edit: 'Éditeur', files: 'Mes Fichiers', openPdf: 'Ouvrir PDF', newFile: 'Nouveau' },
  es: { home: 'Inicio', convert: 'Convertidor', edit: 'Editor', files: 'Mis Archivos', openPdf: 'Abrir PDF', newFile: 'Nuevo' },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onNavigate,
  onOpenFilePicker,
  currentLang,
  onLanguageChange,
  subViewTitle,
  onBackFromSubView,
}) => {
  const t = navLabels[currentLang];

  const NAV_ITEMS: Array<{ id: AppSection; label: string }> = [
    { id: 'home', label: t.home },
    { id: 'convert', label: t.convert },
    { id: 'edit', label: t.edit },
    { id: 'files', label: t.files },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 pt-safe">
      {/* Desktop 3-Zone Top Bar */}
      <div className="hidden md:flex max-w-7xl mx-auto h-16 px-6 items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-red-600 rounded"
        >
          ورقة PDF / PDF Tools
        </button>

        <nav className="flex items-center gap-7" aria-label="التنقل الرئيسي">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                  isActive
                    ? 'text-red-600 border-red-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {/* محدد اللغة */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Globe className="w-4 h-4 text-slate-500 mx-1" />
            {(['ar', 'en', 'fr', 'es'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLanguageChange(l)}
                className={`px-2 py-1 text-xs font-bold rounded-lg uppercase transition-colors ${
                  currentLang === l ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenFilePicker}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>{t.openPdf}</span>
          </button>
        </div>
      </div>

      {/* Mobile Compact App Bar (52px) */}
      <div className="flex md:hidden h-[52px] px-4 items-center justify-between gap-2">
        {subViewTitle && onBackFromSubView ? (
          <>
            <button
              type="button"
              onClick={onBackFromSubView}
              aria-label="رجوع"
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-slate-700 hover:text-slate-900 rounded-xl active:bg-slate-100"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold text-slate-900 truncate flex-1 text-center">
              {subViewTitle}
            </h1>
            <button
              type="button"
              onClick={onOpenFilePicker}
              className="min-h-[44px] px-2 text-xs font-semibold text-red-600 whitespace-nowrap shrink-0 flex items-center"
            >
              {t.newFile}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 min-h-[44px] flex items-center"
              >
                ورقة PDF
              </button>
              {/* محدد لغة مصغر للهاتف */}
              <select
                value={currentLang}
                onChange={(e) => onLanguageChange(e.target.value as any)}
                className="bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-1.5 py-1 focus:outline-none"
              >
                <option value="ar">AR</option>
                <option value="en">EN</option>
                <option value="fr">FR</option>
                <option value="es">ES</option>
              </select>
            </div>
            <button
              type="button"
              onClick={onOpenFilePicker}
              className="min-h-[36px] px-3 py-1 rounded-xl bg-red-600 text-white text-xs font-semibold active:scale-[0.98] transition-transform whitespace-nowrap shrink-0 flex items-center gap-1"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>{t.openPdf}</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
