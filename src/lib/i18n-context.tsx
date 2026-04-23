'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { translations, type Locale, type TranslationKey } from './translations';

interface I18nContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (namespace: TranslationKey, key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = 'axpo-locale';

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');
    const [isHydrated, setIsHydrated] = useState(false);

    // Load locale from localStorage after hydration
    useEffect(() => {
        const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
        if (stored === 'en' || stored === 'es') {
            setLocaleState(stored);
        }
        setIsHydrated(true);
    }, []);

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        if (typeof window !== 'undefined') {
            localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
            // Update HTML lang attribute
            document.documentElement.lang = newLocale;
        }
    }, []);

    const t = useCallback((namespace: TranslationKey, key: string, params?: Record<string, string | number>) => {
        const namespaceTranslations = translations[locale][namespace];
        if (!namespaceTranslations) {
            return key;
        }

        let text = (namespaceTranslations as any)[key] || key;

        // Replace parameters if provided
        if (params) {
            Object.entries(params).forEach(([param, value]) => {
                text = text.replace(`{${param}}`, String(value));
            });
        }

        return text;
    }, [locale]);

    // Update HTML lang attribute on locale change
    useEffect(() => {
        if (isHydrated && typeof window !== 'undefined') {
            document.documentElement.lang = locale;
        }
    }, [locale, isHydrated]);

    return (
        <I18nContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
}
