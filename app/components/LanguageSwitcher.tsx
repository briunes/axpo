'use client';

import { useI18n } from '../../src/lib/i18n-context';

export function LanguageSwitcher() {
    const { locale, setLocale } = useI18n();

    return (
        <div style={{ padding: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ marginRight: '10px' }}>Language:</span>
            <button
                onClick={() => setLocale('en')}
                style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: locale === 'en' ? '#007bff' : '#fff',
                    color: locale === 'en' ? '#fff' : '#000',
                    fontWeight: locale === 'en' ? 'bold' : 'normal',
                }}
            >
                English
            </button>
            <button
                onClick={() => setLocale('es')}
                style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: locale === 'es' ? '#007bff' : '#fff',
                    color: locale === 'es' ? '#fff' : '#000',
                    fontWeight: locale === 'es' ? 'bold' : 'normal',
                }}
            >
                Español
            </button>
        </div>
    );
}
