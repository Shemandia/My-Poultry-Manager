"use client";

import { useLanguageStore } from "@/store/language";

export function LanguagePill() {
  const { locale, setLocale } = useLanguageStore();

  return (
    <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === "en"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-400 hover:text-gray-600"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("sw")}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === "sw"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-400 hover:text-gray-600"
        }`}
      >
        SW
      </button>
    </div>
  );
}
