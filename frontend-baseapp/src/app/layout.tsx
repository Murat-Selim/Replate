import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Replate",
  description: "Shop smart. Nourish well. Earn onchain.",
  icons: {
    icon: "/replate-image.png",
    shortcut: "/replate-image.png",
  },
  other: {
    'base:app_id': '69a867e33dc3043730868ccb',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased selection:bg-brand-primary selection:text-white"
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
