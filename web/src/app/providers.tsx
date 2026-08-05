"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { useLanguageStore } from "@/store/language";
import enMessages from "../../messages/en.json";
import swMessages from "../../messages/sw.json";

function IntlWrapper({ children }: { children: React.ReactNode }) {
  const locale = useLanguageStore((s) => s.locale);
  return (
    <NextIntlClientProvider locale={locale} messages={locale === "sw" ? swMessages : enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <IntlWrapper>{children}</IntlWrapper>
    </QueryClientProvider>
  );
}
