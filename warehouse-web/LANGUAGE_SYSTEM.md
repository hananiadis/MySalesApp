# Language System Documentation

## Overview

The warehouse-web application supports multiple languages (currently English and Greek) with easy switching between them.

## Architecture

### File Structure

```
src/
├── utils/
│   └── translations.js          # Main translation file
└── components/
    └── LanguageSwitcher/
        └── LanguageSwitcher.jsx # Language switcher component
```

### Translation File (`src/utils/translations.js`)

Contains two language objects:
- `en` - English translations
- `el` - Greek translations (Ελληνικά)

The file exports:
- `getTranslations()` - Returns translations for current language
- `setLanguage(lang)` - Changes language and reloads the app
- `getCurrentLang()` - Returns current language code
- `default` export - Current language translations (used as `t` in components)

## Usage

### In Components

Import translations at the top of your component:

```javascript
import t from '../../utils/translations';
```

Use translations in your JSX:

```javascript
<h1>{t.dashboard.title}</h1>
<button>{t.common.save}</button>
<p>{t.stockList.noProducts}</p>
```

### Language Switcher

The `LanguageSwitcher` component is included in the `MainLayout` and displays EN/ΕΛ buttons:
- Highlights the current language
- Switches language on click
- Automatically reloads the page to apply changes

### Language Persistence

The selected language is stored in `localStorage` with key `appLanguage`:
- Persists across browser sessions
- Defaults to Greek (`el`) if not set
- Changes take effect immediately after page reload

## Adding a New Language

1. **Add translation object** in `translations.js`:

```javascript
export const fr = {
  nav: {
    dashboard: 'Tableau de bord',
    // ... rest of translations
  },
  // ... all sections
};
```

2. **Update translations object**:

```javascript
const translations = {
  en,
  el,
  fr, // Add new language
};
```

3. **Add button** in `LanguageSwitcher.jsx`:

```javascript
<button
  onClick={() => handleLanguageChange('fr')}
  className={...}
>
  FR
</button>
```

## Translation Structure

All translations follow this hierarchical structure:

```javascript
{
  nav: {
    // Navigation menu items
    dashboard: 'Dashboard',
    stock: 'Stock',
    // ...
  },
  common: {
    // Common words used throughout app
    search: 'Search',
    save: 'Save',
    // ...
  },
  dashboard: {
    // Dashboard screen specific
    title: 'Warehouse Dashboard',
    // ...
  },
  stockList: {
    // Stock List screen specific
    title: 'Stock List',
    // ...
  },
  stockAdjustment: {
    // Stock Adjustment screen specific
  },
  productDetail: {
    // Product Detail screen specific
  },
  inventoryCount: {
    // Inventory Count screen specific
  },
  errors: {
    // Error messages
  }
}
```

## Current Translations

### Screens Fully Translated
- ✅ Dashboard (`dashboard`)
- ✅ Stock List (`stockList`)
- ✅ Stock Adjustment (`stockAdjustment`)
- ✅ Product Detail (`productDetail`)
- ✅ Inventory Count (`inventoryCount`)
- ✅ Navigation Menu (`nav`)
- ✅ Common Terms (`common`)

### Screens To Be Translated
- ⏳ Supplier Orders
- ⏳ Activity Log
- ⏳ Login Screen

## Best Practices

1. **Never hardcode strings** - Always use translation keys
2. **Use descriptive keys** - `stockList.noProducts` instead of `stockList.msg1`
3. **Group by screen/feature** - Keep related translations together
4. **Keep structure identical** - All language objects must have same keys
5. **Use common for reusable terms** - Avoid duplicating "Save", "Cancel", etc.
6. **Update both languages** - When adding new keys, update all language objects

## Examples

### Simple Translation
```javascript
<h1>{t.dashboard.title}</h1>
// Renders: "Warehouse Dashboard" (EN) or "Πίνακας Ελέγχου Αποθήκης" (EL)
```

### Conditional Rendering
```javascript
<p>{product.isActive ? t.common.yes : t.common.no}</p>
// Renders: "Yes/No" (EN) or "Ναι/Όχι" (EL)
```

### Dynamic Content
```javascript
<p>{t.stockList.showing} {count} {t.common.products}</p>
// Renders: "Showing 10 products" (EN) or "Εμφάνιση 10 προϊόντα" (EL)
```

### Button States
```javascript
{isSaving ? t.common.saving : t.common.save}
// Renders: "Saving..." or "Save" (EN) / "Αποθήκευση..." or "Αποθήκευση" (EL)
```

## Troubleshooting

**Issue**: Translations not showing
- Check import: `import t from '../../utils/translations'`
- Verify translation key exists in both `en` and `el` objects
- Check browser console for errors

**Issue**: Language not switching
- Clear browser localStorage: `localStorage.clear()`
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Check localStorage in DevTools: Look for `appLanguage` key

**Issue**: Missing translation
- Add the key to both `en` and `el` objects in `translations.js`
- Follow the existing structure and naming conventions
- Rebuild if using development server

## Language Codes

- `en` - English
- `el` - Ελληνικά (Greek)

Default language: Greek (`el`)
