import type { Metadata } from "next";
import { Cormorant_Garamond, Geist_Mono, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import { buildOrganizationJsonLd, getSeoSiteOrigin } from "@/lib/seo/site";
import { getThemeInlineScript } from "@/lib/theme/theme-inline-script";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: getSeoSiteOrigin(),
  title: {
    default: "AKILI Risk Intelligence",
    template: "%s | AKILI Risk Intelligence",
  },
  description:
    "Governance intelligence platform for modern family wealth — structured assessments, prioritized risks, and actionable recommendations for professional firms and families.",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
  },
  manifest: '/site.webmanifest',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const isBrandedTenant = headersList.get("x-branded-mode") === "true";
  const forceTenantLight = headersList.get("x-tenant-force-light") === "true";
  const session = await auth();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      data-tenant-force-light={forceTenantLight ? "true" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeInlineScript(),
          }}
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#4EA5D9" />
        <meta name="msapplication-TileColor" content="#4EA5D9" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildOrganizationJsonLd()),
          }}
        />
      </head>
      <body
        className={`${manrope.variable} ${geistMono.variable} ${cormorant.variable} bg-background text-foreground antialiased`}
        data-branded-mode={isBrandedTenant ? "true" : undefined}
        suppressHydrationWarning
      >
        <Providers session={session}>
          <div className="relative isolate min-h-screen">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
