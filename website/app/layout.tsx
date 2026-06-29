import "./global.css";
import "@/components/features/articles.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Inter } from "next/font/google";
import { GITHUB_URL, DISCORD_URL } from "./layout.config";
import {
  SITE_URL,
  TITLE,
  DESCRIPTION,
  SHORT_DESCRIPTION,
  OG_IMAGE,
  TWITTER_IMAGE,
  OG_IMAGE_ALT,
} from "@/lib/site";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Mutka",
  },
  description: DESCRIPTION,
  applicationName: "Mutka",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  authors: [{ name: "Ilian", url: GITHUB_URL }],
  creator: "Ilian",
  publisher: "Mutka",
  category: "technology",
  keywords: [
    "macos",
    "file explorer",
    "finder alternative",
    "tauri",
    "tauri 2",
    "react",
    "modular",
    "module system",
    "plugin system",
    "liquid glass",
    "open source",
    "rust",
    "ai-built modules",
    "mcp",
    "sqlite viewer",
    "webdav",
    "macos app",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
      "x-default": "/",
    },
    types: {
      // Advertise the AI-readable docs index (llmstxt.org) to crawlers.
      "text/plain": [{ url: "/llms.txt", title: "llms.txt" }],
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Mutka",
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SHORT_DESCRIPTION,
    images: [{ url: TWITTER_IMAGE, alt: OG_IMAGE_ALT }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon.png", sizes: "512x512" }],
    shortcut: ["/icon.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Mutka",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14141b" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

// Structured data (schema.org JSON-LD) — helps search engines and AI crawlers
// understand the project as a piece of software with documentation.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Mutka",
      description: DESCRIPTION,
      inLanguage: "en-US",
      publisher: { "@id": `${SITE_URL}/#org` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/docs?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "en-US",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      primaryImageOfPage: { "@id": `${SITE_URL}/#og` },
      breadcrumb: { "@id": `${SITE_URL}/#breadcrumb` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE_URL}/#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Documentation",
          item: `${SITE_URL}/docs`,
        },
      ],
    },
    {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/#og`,
      url: OG_IMAGE,
      contentUrl: OG_IMAGE,
      width: 1200,
      height: 630,
      caption: OG_IMAGE_ALT,
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Mutka",
      url: SITE_URL,
      description: DESCRIPTION,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.png`,
        width: 512,
        height: 512,
      },
      sameAs: [GITHUB_URL, DISCORD_URL],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Mutka",
      description: DESCRIPTION,
      url: SITE_URL,
      applicationCategory: "UtilitiesApplication",
      applicationSubCategory: "File Manager",
      operatingSystem: "macOS 10.14+",
      softwareVersion: "0.1",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
      isAccessibleForFree: true,
      author: { "@id": `${SITE_URL}/#org` },
      publisher: { "@id": `${SITE_URL}/#org` },
      image: { "@id": `${SITE_URL}/#og` },
      screenshot: { "@id": `${SITE_URL}/#og` },
      downloadUrl: `${GITHUB_URL}/releases`,
      softwareHelp: `${SITE_URL}/docs`,
      featureList: [
        "Modular architecture — every feature is a single-file module",
        "Permission-sandboxed modules running in isolated Web Workers",
        "Built-in features use the same public module API as the community",
        "AI-buildable modules with no build step and zero core imports",
        "Native macOS Liquid Glass interface built on Tauri 2",
      ],
      keywords:
        "macOS, file explorer, modular, Tauri, React, open source, AI modules",
    },
    {
      "@type": "SoftwareSourceCode",
      "@id": `${SITE_URL}/#source`,
      name: "Mutka",
      description: DESCRIPTION,
      codeRepository: GITHUB_URL,
      programmingLanguage: ["TypeScript", "Rust"],
      runtimePlatform: "Tauri 2",
      license: "https://opensource.org/licenses/MIT",
      author: { "@id": `${SITE_URL}/#org` },
      about: { "@id": `${SITE_URL}/#app` },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Mutka?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Mutka is a community-driven, modular file explorer for macOS built with Tauri 2 and React. The core ships only infrastructure; every real feature — copy, paste, navigation, columns, cloud mounts — is a module.",
          },
        },
        {
          "@type": "Question",
          name: "How do you build a module for Mutka?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A module is a single file that exports defineModule({ id, permissions, commands, openHandlers, setup }). It imports nothing from the core and only touches the system through a permission-checked host object — which makes modules small, safe, and easy for an AI to generate.",
          },
        },
        {
          "@type": "Question",
          name: "Is Mutka free and open source?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Mutka is MIT licensed and free to use.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
