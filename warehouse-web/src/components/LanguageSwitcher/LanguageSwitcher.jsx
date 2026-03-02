import React from 'react';
import { setLanguage, getCurrentLang } from '../../utils/translations';

const LanguageSwitcher = () => {
  const currentLang = getCurrentLang();

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleLanguageChange('en')}
        className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors ${
          currentLang === 'en'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
        title="English"
      >
        <span className="text-base">🇬🇧</span>
        <span>EN</span>
      </button>
      <button
        onClick={() => handleLanguageChange('el')}
        className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors ${
          currentLang === 'el'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
        title="Ελληνικά"
      >
        <span className="text-base">🇬🇷</span>
        <span>ΕΛ</span>
      </button>
    </div>
  );
};

export default LanguageSwitcher;
