'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { useStoredValue } from '../hooks/useStoredValue';
import { en, PartialTranslations } from '../locales/en';
import { km } from '../locales/km';
import { LANG_COOKIE } from '../lib/server-messages';

export type Language = 'en' | 'km';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
  dictionary: PartialTranslations;
}

const dictionaries: Record<Language, PartialTranslations> = { en, km };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Khmer until this browser remembers another choice.
  const [stored, setLanguage] = useStoredValue('livestock_lang', 'km');
  const language: Language = stored === 'en' ? 'en' : 'km';

  // Server actions answer common messages in this language (src/lib/server-messages.ts), so tell the server.
  useEffect(() => {
    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${LANG_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax${secure}`;
  }, [language]);

  const t = (path: string, fallback?: string): string => {
    const keys = path.split('.');
    let current: unknown = dictionaries[language] || dictionaries.en;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        // Fallback to English if key missing in Khmer
        let enCurrent: unknown = dictionaries.en;
        for (const enKey of keys) {
          if (enCurrent && typeof enCurrent === 'object' && enKey in enCurrent) {
            enCurrent = (enCurrent as Record<string, unknown>)[enKey];
          } else {
            return fallback || path;
          }
        }
        return typeof enCurrent === 'string' ? enCurrent : (fallback || path);
      }
    }
    
    return typeof current === 'string' ? current : (fallback || path);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dictionary: dictionaries[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
