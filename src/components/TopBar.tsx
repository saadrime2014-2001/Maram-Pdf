import React from 'react';
import { ArrowRight, FilePlus2 } from 'lucide-react';
import type { AppSection } from '../types/pdf';

interface TopBarProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  onOpenFilePicker: () => void;
  subViewTitle?: string;
  onBackFromSubView?: () => void;
}

const NAV_ITEMS: Array<{ id: AppSection; label: string }> = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'convert', label: 'المحول' },
  { id: 'edit', label: 'المحرر' },
  { id: 'files', label: 'ملفاتي' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onNavigate,
  onOpenFilePicker,
  subViewTitle,
  onBackFromSubView,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 pt-safe">
      {/* Desktop 3-Zone Top Bar */}
      <div className="hidden md:flex max-w-7xl mx-auto h-16 px-6 items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-red-600 rounded"
        >
          ورقة PDF
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

        <button
          type="button"
          onClick={onOpenFilePicker}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>فتح ملف PDF</span>
        </button>
      </div>

      {/* Mobile Compact App Bar (52px) */}
      <div className="flex md:hidden h-[52px] px-4 items-center justify-between gap-3">
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
            <h1 className="text-base font-semibold text-slate-900 truncate flex-1 text-center">
              {subViewTitle}
            </h1>
            <button
              type="button"
              onClick={onOpenFilePicker}
              className="min-h-[44px] px-3 text-xs font-semibold text-red-600 whitespace-nowrap shrink-0 flex items-center"
            >
              ملف جديد
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 min-h-[44px] flex items-center"
            >
              ورقة PDF
            </button>
            <button
              type="button"
              onClick={onOpenFilePicker}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold active:scale-[0.98] transition-transform whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>فتح ملف</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
