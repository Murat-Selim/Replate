import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import MiniAppReady from "@/components/MiniAppReady";
import FarcasterProvider from "@/components/FarcasterProvider";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
    const URL = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "https://replate-farcaster.vercel.app";
    return {
        other: {
            'fc:miniapp': JSON.stringify({
                version: 'next',
                imageUrl: `${URL}/replate-logo.png`,
                button: {
                    title: `Launch Replate`,
                    action: {
                        type: 'launch_miniapp',
                        name: 'Replate',
                        url: URL,
                        splashImageUrl: `${URL}/replate-logo.png`,
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
        <FarcasterProvider>
          <MiniAppReady />
          {children}
        </FarcasterProvider>
      </body>
    </html>
  );
}
