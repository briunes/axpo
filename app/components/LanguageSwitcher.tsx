'use client';

import { useI18n } from '../../src/lib/i18n-context';
import { LanguageFlag } from '../../src/lib/LanguageFlag';
import { UI_LANGUAGES } from '../../src/lib/uiLanguages';

export function LanguageSwitcher() {
    const { locale, setLocale, t } = useI18n();

    return (
        <div style={{ padding: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ marginRight: '10px' }}>{t("common", "language")}</span>
            {UI_LANGUAGES.map((language) => (
                <button
                    key={language.code}
                    onClick={() => setLocale(language.code)}
                    style={{
                        padding: '8px 16px',
                        cursor: 'pointer',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        backgroundColor: locale === language.code ? '#007bff' : '#fff',
                        color: locale === language.code ? '#fff' : '#000',
                        fontWeight: locale === language.code ? 'bold' : 'normal',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <LanguageFlag code={language.code} label={language.label} /> {language.label}
                </button>
            ))}
        </div>
    ); 
}
