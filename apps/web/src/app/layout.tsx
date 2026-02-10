import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/app-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "US Data Dashboard",
  description: "US Data Dashboard: deep analytics for federal open data quality, freshness, and trend intelligence."
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 antialiased`}>
        <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-5 text-white shadow-sm">
            <h1 className="sr-only">US Data Dashboard</h1>
            <Image
              src="/us-data-dashboard-logo.svg"
              alt="US Data Dashboard logo"
              width={1024}
              height={320}
              priority
              className="h-auto w-full max-w-[560px]"
            />
            <p className="mt-4 max-w-3xl text-sm text-blue-100">
              Federal data intelligence for dataset growth, metadata quality, openness, staleness risk, agency momentum, and operational
              health.
            </p>
            <div className="mt-4">
              <AppNav />
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
