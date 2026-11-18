import React from 'react';
import { Home, RefreshCw, PenLine, FolderOpen } from 'lucide-react';
import type { AppSection } from '../types/pdf';

interface BottomNavProps {
  activeSection: AppSection;
  currentLang: 'ar' | 'en' | 'fr' | 'es';
  onNavigate: (section: AppSection) => void;
  fileCount: number;
}

const translations = {
  ar: {
    home: 'الرئيسية',
    convert: 'تحويل / Convert',
    edit: 'تعديل',
    files: 'ملفاتي',
  },
  en: {
    home: 'Home',
    convert: 'Convert',
    edit: 'Edit',
    files: 'Files',
  },
  fr: {
    home: 'Accueil',
    convert: 'Convertir',
    edit: 'Éditer',
    files: 'Fichiers',
  },
  es: {
    home: 'Inicio',
    convert: 'Convertir',
    edit: 'Editar',
    files: 'Archivos',
  },
};

export const BottomNav: React.FC<BottomNavProps> = ({
  activeSection,
  currentLang,
  onNavigate,
  fileCount,
}) => {
  const t = translations[currentLang];

  const tabs: Array<{
    id: AppSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'home', label: t.home, icon: Home },
    { id: 'convert', label: t.convert, icon: RefreshCw },
    { id: 'edit', label: t.edit, icon: PenLine },
    { id: 'files', label: t.files, icon: FolderOpen },
  ];

  return (
    <nav
      aria-label="شريط التنقل السفلي"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
    >
      <div className="grid grid-cols-4 h-16 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors relative cursor-pointer ${
                isActive ? 'text-red-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon className="w-[22px] h-[22px]" />
                {tab.id === 'files' && fileCount > 0 && (
                  <span className="absolute -top-1 -left-2 text-[10px] font-mono-num font-semibold text-red-600">
                    {fileCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium tracking-tight whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
