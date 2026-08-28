import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Playfair_Display } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const playfair = Playfair_Display({
  weight: ['400'],
  style: ['italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  title: 'Unfinished Past',
  description: 'Art Collection by Dalos Dov',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark');})();`,
          }}
        />
      </head>
      <body
        className={`${GeistSans.className} ${playfair.variable} bg-[#FFFFFC] text-zinc-900 dark:bg-[#0a0a0a] dark:text-zinc-100 min-h-screen transition-colors duration-200`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
