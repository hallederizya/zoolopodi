import { getRequestConfig } from "next-intl/server";

export const i18n = {
  defaultLocale: "tr",
  locales: ["tr", "en"],
} as const;

export type Locale = typeof i18n["locales"][number];

export default getRequestConfig(async ({ locale }) => {
  return {
    messages: (await import(`./messages/${locale}.json`)).default,
  } as any;
});
