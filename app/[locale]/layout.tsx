import { NextIntlClientProvider } from "next-intl";
import { i18n, Locale } from "@/i18n";
import "leaflet/dist/leaflet.css";
import "../globals.css";

export function generateStaticParams() {
  return i18n.locales.map((l) => ({ locale: l }));
}

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: { locale: Locale } }) {
  // dynamic import of messages based on locale
  const messages = (await import(`../../messages/${params.locale}.json`)).default;
  return (
    <html lang={params.locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
