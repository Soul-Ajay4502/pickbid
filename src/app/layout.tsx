import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cricket Player Cards",
  description: "Create and share cricket player cards for your league",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* <header className="bg-linear-to-r from-green-900 to-green-700 border-b border-green-600 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
            <span className="text-2xl">🏏</span>
            <a href="/" className="text-white font-bold text-xl hover:text-green-200 transition-colors">
              Cricket Player Cards
            </a>
          </div>
        </header> */}
        <main className="flex-1">
          {children}
        </main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
