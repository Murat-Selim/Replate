import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import MiniAppReady from "@/components/MiniAppReady";
import BaseAccountProvider from "@/components/BaseAccountProvider";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
    return {
        other: {
        'fc:miniapp': JSON.stringify({
            version: 'next',
            imageUrl: 'https://replate61.vercel.app/replate-logo.jpg',
            button: {
                title: `Launch Replate`,
                action: {
                    type: 'launch_miniapp',
                    name: 'Replate',
                    url: 'https://replate61.vercel.app',
                    splashImageUrl: 'https://replate61.vercel.app/replate-logo.jpg',
                    splashBackgroundColor: '#000000',
                },
            },
        }),
        },
    };
    }

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
        <BaseAccountProvider>
          <MiniAppReady />
          {children}
        </BaseAccountProvider>
      </body>
    </html>
  );
}
