import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ParakhIQ — AI Equity Research Terminal",
  description: "AI-driven investment research agent for Indian equity markets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased bg-background text-on-surface terminal-grid">
        {children}
      </body>
    </html>
  );
}
