import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import MiniAppReady from "@/components/MiniAppReady";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Replate - Shop Smart, Save the Planet",
  description: "AI-powered zero-waste shopping assistant on Base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${outfit.variable} antialiased selection:bg-brand-primary selection:text-white`}
      >
        <MiniAppReady />
        {children}
      </body>
    </html>
  );
}
