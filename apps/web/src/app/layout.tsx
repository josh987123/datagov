import type { Metadata } from "next";
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
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200">US Data Dashboard</p>
            <h1 className="mt-2 text-2xl font-semibold">Federal data intelligence and catalog observability</h1>
            <p className="mt-2 max-w-3xl text-sm text-blue-100">
              Measure dataset growth, metadata quality, openness, staleness risk, agency momentum, and operational health from one
              unified control plane.
            </p>
            <p className="mt-3 text-xs text-blue-200">Logo placeholder reserved and ready for your upcoming brand asset.</p>
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
