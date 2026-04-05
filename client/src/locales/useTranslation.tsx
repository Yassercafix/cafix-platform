import { useState, useEffect, useContext, createContext, ReactNode, useCallback } from 'react';

interface TranslationContextType {
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLanguage: (lang: string) => void;
  language: string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
  defaultLanguage?: string;
}

const translationsCache: Record<string, Record<string, string>> = {};

export const TranslationProvider = ({ children, defaultLanguage = 'en' }: TranslationProviderProps) => {
  const [language, setLanguageState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('preferredLanguage');
      if (saved) return saved;
      return navigator.language.split('-')[0] === 'ar' ? 'ar' : defaultLanguage;
    }
    return defaultLanguage;
  });
  
  const [messages, setMessages] = useState<Record<string, string>>({});

  const loadMessages = useCallback(async (lang: string) => {
    if (translationsCache[lang]) {
      setMessages(translationsCache[lang]);
      return;
    }

    try {
      // Use a more robust path for production
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) {
        // Try alternative path if first one fails
        const altResponse = await fetch(`/src/locales/${lang}.json`);
        if (!altResponse.ok) throw new Error(`Could not load translation file for ${lang}`);
        const data = await altResponse.json();
        translationsCache[lang] = data;
        setMessages(data);
      } else {
        const data = await response.json();
        translationsCache[lang] = data;
        setMessages(data);
      }
    } catch (error) {
      console.error(`Error loading translation for ${lang}:`, error);
      if (lang !== 'en') {
        loadMessages('en');
      }
    }
  }, []);

  useEffect(() => {
    loadMessages(language);

    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLanguage', language);
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    }
  }, [language, loadMessages]);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    let message = messages[key] || key;
    if (vars) {
      for (const [varKey, varValue] of Object.entries(vars)) {
        message = message.replace(`{${varKey}}`, String(varValue));
      }
    }
    return message;
  }, [messages]);

  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLanguage', lang);
    }
  }, []);

  return (
    <TranslationContext.Provider value={{ t, setLanguage, language }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
