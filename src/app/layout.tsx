import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "steven.marketing — Measurable growth.",
  description: "Independent marketing, built around measurable commercial outcomes. Research, execution and clear reporting.",
  applicationName: "steven.marketing",
  icons: {
    icon: [
      { url: "/brand/s.m.svg", type: "image/svg+xml", sizes: "any", media: "(prefers-color-scheme: light)" },
      { url: "/brand/S.m-white.svg", type: "image/svg+xml", sizes: "any", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/brand/s.m.svg",
  },
  openGraph: {
    type: "website",
    siteName: "steven.marketing",
    title: "steven.marketing — Measurable growth.",
    description: "Independent marketing, built around measurable commercial outcomes. Research, execution and clear reporting.",
  },
  metadataBase: new URL("https://steven.marketing"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-AU"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "steven.marketing",
    url: "https://steven.marketing",
    logo: "https://steven.marketing/brand/s.m.svg",
  }) }} />{children}</body></html>;
}
