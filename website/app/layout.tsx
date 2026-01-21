import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AGPM - Agent Package Manager",
    template: "%s | AGPM",
  },
  description:
    "Universal package manager for AI coding tool artifacts. Manage skills, commands, and hooks across Claude, OpenCode, Codex, and more.",
  keywords: [
    "agpm",
    "package manager",
    "AI tools",
    "Claude",
    "skills",
    "artifacts",
    "CLI",
  ],
  authors: [{ name: "Kepler16" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://agpm.dev",
    title: "AGPM - Agent Package Manager",
    description:
      "Universal package manager for AI coding tool artifacts. Manage skills, commands, and hooks across Claude, OpenCode, Codex, and more.",
    siteName: "AGPM",
  },
  twitter: {
    card: "summary_large_image",
    title: "AGPM - Agent Package Manager",
    description:
      "Universal package manager for AI coding tool artifacts. Manage skills, commands, and hooks across Claude, OpenCode, Codex, and more.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
