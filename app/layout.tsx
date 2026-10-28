import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource/geist-mono/400.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Miraflores | The work behind the numbers',
  description: 'A precise, evidence-first workspace for tax review.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
