import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'PileTest Pro | Pile Load Testing',
  description: 'Mobile-first pile load test data entry and IS 2911-compliant report generation',
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




