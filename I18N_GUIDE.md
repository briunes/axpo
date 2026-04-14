# i18n (Internationalization) Setup

This project uses a simple React Context-based internationalization system with support for English (en) and Spanish (es). **URLs remain unchanged** - the language preference is stored in localStorage.

## How It Works

- **No URL changes**: URLs stay the same (e.g., `/dashboard` for both languages)
- **Client-side storage**: Language preference saved in localStorage
- **Simple React Context**: Uses React Context API for state management
- **Type-safe**: TypeScript support for translation keys

## Configuration Files

- **`src/lib/translations.ts`**: Contains all translations for English and Spanish
- **`src/lib/i18n-context.tsx`**: React Context provider and useI18n hook
- **`app/components/LanguageSwitcher.tsx`**: Language switcher component

## Usage

### 1. Using Translations in Client Components

```tsx
"use client";

import { useI18n } from "../src/lib/i18n-context";

export default function MyComponent() {
  const { t, locale } = useI18n();

  return (
    <div>
      <h1>{t("simulator", "title")}</h1>
      <p>{t("common", "welcome")}</p>
      <button>{t("common", "save")}</button>
    </div>
  );
}
```

### 2. Translation with Parameters

```tsx
"use client";

import { useI18n } from "../src/lib/i18n-context";

export default function ValidationComponent() {
  const { t } = useI18n();

  return (
    <div>
      <p>{t("validation", "minLength", { min: 8 })}</p>
      <p>{t("validation", "maxLength", { max: 100 })}</p>
    </div>
  );
}
```

### 3. Changing Language

```tsx
"use client";

import { useI18n } from "../src/lib/i18n-context";

export default function LanguageSelector() {
  const { locale, setLocale } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as "en" | "es")}
    >
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  );
}
```

### 4. Using the Built-in Language Switcher

```tsx
import { LanguageSwitcher } from "./components/LanguageSwitcher";

export default function Layout() {
  return (
    <div>
      <LanguageSwitcher />
      {/* rest of your layout */}
    </div>
  );
}
```

## Available Translation Namespaces

The following namespaces are available in `src/lib/translations.ts`:

- **`common`**: Common UI elements (buttons, actions, etc.)
- **`nav`**: Navigation menu items
- **`auth`**: Authentication related text
- **`simulator`**: Simulator-specific content
- **`client`**: Client management
- **`agency`**: Agency management
- **`user`**: User management
- **`validation`**: Form validation messages
- **`messages`**: System messages and notifications

## Adding New Translations

Edit `src/lib/translations.ts` and add your translations to both `en` and `es` objects:

```typescript
export const translations = {
  en: {
    // ... existing namespaces
    products: {
      title: "Products",
      addNew: "Add New Product",
      price: "Price",
    },
  },
  es: {
    // ... existing namespaces
    products: {
      title: "Productos",
      addNew: "Agregar Nuevo Producto",
      price: "Precio",
    },
  },
};
```

Then update the type:

```typescript
export type TranslationKey = keyof (typeof translations)["en"];
```

Use it in your component:

```tsx
"use client";

import { useI18n } from "../src/lib/i18n-context";

export default function Products() {
  const { t } = useI18n();

  return (
    <div>
      <h1>{t("products", "title")}</h1>
      <button>{t("products", "addNew")}</button>
    </div>
  );
}
```

## Language Persistence

The selected language is automatically saved to localStorage with the key `axpo-locale`. When a user returns to the site, their language preference is restored.

## Best Practices

1. **Always use translations**: Avoid hardcoded strings in components
2. **Keep namespaces organized**: Group related translations together
3. **Test both languages**: Always verify translations in both English and Spanish
4. **Use descriptive keys**: Make translation keys self-explanatory
5. **Keep translations synchronized**: Ensure both `en` and `es` have the same keys
6. **Mark components as 'use client'**: The i18n context only works in client components

## Server Components

Currently, this i18n solution only works in client components. If you need translations in server components, you can:

1. Pass translations as props from a client component
2. Import the translations directly and select the language server-side based on headers/cookies
3. Consider using a more advanced i18n library if extensive server-side translation is needed

## Example: Full Page with Translations

```tsx
"use client";

import { useI18n } from "../src/lib/i18n-context";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <div>
      <header>
        <h1>{t("nav", "dashboard")}</h1>
        <LanguageSwitcher />
      </header>

      <main>
        <section>
          <h2>{t("simulator", "title")}</h2>
          <p>{t("simulator", "description")}</p>
          <button>{t("simulator", "newSimulation")}</button>
        </section>

        <section>
          <h2>{t("client", "title")}</h2>
          <button>{t("client", "newClient")}</button>
        </section>
      </main>
    </div>
  );
}
```

## Advantages of This Approach

✅ **Simple**: No complex routing or URL rewriting  
✅ **No URL pollution**: URLs stay clean without locale prefixes  
✅ **Fast**: Client-side only, no server configuration needed  
✅ **Persistent**: Language preference saved across sessions  
✅ **Type-safe**: TypeScript support for better developer experience  
✅ **Easy to use**: Simple API with `t()` function

## Limitations

- Only works in client components (marked with 'use client')
- Language detection is client-side only (no server-side rendering of different languages)
- SEO considerations: Search engines will only see the default language initially
