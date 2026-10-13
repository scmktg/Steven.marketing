import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "steven.marketing — Measurable growth.",
  description: "Independent marketing, built around measurable commercial outcomes. Research, execution and clear reporting.",
  metadataBase: new URL("https://steven.marketing"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-AU"><body>{children}</body></html>;
}
