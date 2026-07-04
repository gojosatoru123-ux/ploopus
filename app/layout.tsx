import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://ploopus.app"),
  title: {
    default: "Ploopus | Your Creative Space",
    template: "%s | Ploopus",
  },
  description: "The single destination for your ideas, notes, and graph-based thinking.",
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // Options: "default", "black", "black-translucent"
    title: "Ploopus",
  },
  openGraph: {
    title: "Ploopus",
    description: "Organize your life with Ploopus.",
    url: "https://ploopus.app",
    siteName: "Ploopus",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "Ploopus Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Ploopus",
    description: "Organize your life with Ploopus.",
    images: ["/android-chrome-512x512.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster toastOptions={{
          style: {
            background: 'white',
            borderLeft: '4px solid rgba(92,138,121, 1)',
            borderRight: '1px solid rgba(92,138,121, 0.4)',  
            borderTop: '1px solid rgba(92,138,121, 0.4)',  
            borderBottom: '1px solid rgba(92,138,121, 0.4)',            
            color: 'black',
          },
        }} />
      </body>
    </html>
  );
}