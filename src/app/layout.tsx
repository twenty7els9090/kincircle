import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Kinnect — Семейный координатор",
  description: "Координируйте задачи с семьёй. Будьте организованы вместе.",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#F2F2F7" />
      </head>
      <body
        className="antialiased"
        style={{
          background: 'var(--ios-bg)',
          fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, system-ui, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          overscrollBehavior: 'none',
        }}
      >
        {children}
      </body>
    </html>
  );
}
