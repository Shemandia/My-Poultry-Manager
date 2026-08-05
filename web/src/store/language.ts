import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "en" | "sw";

interface LanguageStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "mpm-locale" }
  )
);
