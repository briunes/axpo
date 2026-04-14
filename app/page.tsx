'use client';

import { useI18n } from '../src/lib/i18n-context';
import { LanguageSwitcher } from './components/LanguageSwitcher';

export default function HomePage() {
  const { t } = useI18n();

  return (
    <main style={{ padding: '20px' }}>
      <LanguageSwitcher />
      <h1>{t('simulator', 'title')}</h1>
      <p>{t('simulator', 'description')}</p>
      <hr style={{ margin: '20px 0' }} />
      <h2>System Links</h2>
      <ul>
        <li>
          <a href="/internal/login">Internal Login</a>
        </li>
        <li>
          <a href="/api/v1/internal/health">Health endpoint: /api/v1/internal/health</a>
        </li>
        <li>
          <a href="/api/v1/docs">Public docs: /api/v1/docs</a>
        </li>
      </ul>
    </main>
  );
}
