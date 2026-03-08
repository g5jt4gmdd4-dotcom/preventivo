import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const basePath = process.env.NODE_ENV === 'production' ? '/Prev3' : '';

export const metadata: Metadata = {
  title: "Generatore Preventivo - Villaggio La Roccia",
  description: "App per generare preventivi per Villaggio La Roccia Camping",
  icons: {
    icon: `${basePath}/logo.png`,
    shortcut: `${basePath}/logo.png`,
    apple: `${basePath}/logo.png`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
