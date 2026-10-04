import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BC Reader — Business Card Reader",
  description:
    "Photograph a business card, check the fields, and file the person into the Contacts app on iPhone or Android.",
  applicationName: "BC Reader",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BC Reader",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3efe4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
