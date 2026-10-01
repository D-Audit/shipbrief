import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Instrument_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

/** Display face for the landing hero headline only. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ShipBrief: Turn shipped work into customer communication",
    template: "%s · ShipBrief",
  },
  description:
    "ShipBrief turns product work into clear release communication across your changelog, email and in-app, then connects customer feedback back to the roadmap.",
  icons: {
    icon: [
      { url: "/favicon.ico?v=wing2", sizes: "any" },
      { url: "/favicon-wing2.svg", type: "image/svg+xml" },
      { url: "/favicon-wing2-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-wing2-64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: "/apple-touch-icon-wing2.png",
  },
  openGraph: {
    title: "ShipBrief",
    description: "Turn shipped work into customer communication your team reviews, publishes and learns from.",
    siteName: "ShipBrief",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecedef" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider delay={200}>{children}</TooltipProvider>
          <Toaster position="bottom-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
