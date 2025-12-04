import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'PileTest Pro | Upload Field Readings',
  description: 'Transform handwritten pile load test readings into professional IS 2911-compliant reports',
};

/**
 * Root layout wrapping all pages in the application.
 * Why: Provides consistent HTML structure, metadata, and global styles
 * across all routes in the Next.js App Router.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

