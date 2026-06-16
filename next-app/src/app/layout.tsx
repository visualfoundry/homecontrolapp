import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { SwRegistrar } from '@/components/SwRegistrar';

export const metadata: Metadata = {
  title: 'Home Control',
  description: 'Home automation control panel',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Home Control',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEEDEA' },
    { media: '(prefers-color-scheme: dark)',  color: '#0E0E0D' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/*
        data-theme is toggled on #hca-root by the client store,
        not on <html>, so theming is scoped to the app container.
      */}
      <body>
        <SwRegistrar />
        <div id="hca-root" className="relative flex flex-col h-full w-full max-w-[430px] md:max-w-none mx-auto overflow-hidden bg-bg">
          {children}
        </div>
      </body>
    </html>
  );
}
