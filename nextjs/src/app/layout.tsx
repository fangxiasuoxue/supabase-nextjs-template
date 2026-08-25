import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import CookieConsent from "@/components/Cookies";
import { GoogleAnalytics } from '@next/third-parties/google'
import { Toaster } from 'sonner'


const siteName = process.env.NEXT_PUBLIC_PRODUCTNAME || "JIEDIAN";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const siteDescription =
  process.env.NEXT_PUBLIC_PRODUCTDESCRIPTION ||
  "One-stop cross-border e-commerce services, global cloud hosting, and DTC growth technology. 跨境电商一站式服务、全球云服务托管与独立站增长技术。";

export const metadata: Metadata = {
  // 设置 NEXT_PUBLIC_SITE_URL 后,OG/canonical 用绝对地址
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    type: "website",
    siteName,
    title: siteName,
    description: siteDescription,
    url: siteUrl || undefined,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
  // 放一张 app/opengraph-image.(png|jpg) 即自动生成 og:image(1200×630);favicon 已在 app/favicon.ico
};

import { LanguageProvider } from "@/lib/context/LanguageContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let theme = process.env.NEXT_PUBLIC_THEME
  if (!theme) {
    theme = "theme-sass3"
  }
  const gaID = process.env.NEXT_PUBLIC_GOOGLE_TAG;
  return (
    <html lang="en">
      <body className={theme}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
        <Analytics />
        <CookieConsent />
        {gaID && (
          <GoogleAnalytics gaId={gaID} />
        )}
        <Toaster />

      </body>
    </html>
  );
}
