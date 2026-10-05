import type { Metadata, Viewport } from "next";
import { Kantumruy_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";
import ReactQueryProvider from "@/components/providers/ReactQueryProvider";
import ServiceWorkerRegister from "@/components/providers/ServiceWorkerRegister";

// One family for English and Khmer, so both scripts look consistent.
const kantumruy = Kantumruy_Pro({
  variable: "--font-kantumruy",
  subsets: ["latin", "khmer"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CC Livestock",
  description: "Farm records for your cattle: weights, health, feed and sales.",
  icons: {
    icon: "/logo.png",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  // Opens full screen (no Safari bars) when added to an iPhone/iPad home screen.
  appleWebApp: {
    capable: true,
    title: "CC Livestock",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E7A38",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${kantumruy.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink font-sans">
        <ReactQueryProvider>
          {children}
        </ReactQueryProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
