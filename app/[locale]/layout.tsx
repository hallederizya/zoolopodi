import { NextIntlClientProvider } from "next-intl";
import { i18n, Locale } from "@/i18n";
import "leaflet/dist/leaflet.css";
import "../globals.css";

export function generateStaticParams() {
  return i18n.locales.map((l) => ({ locale: l }));
}

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: Locale }> }) {
  // dynamic import of messages based on locale
  const { locale } = await params;
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
