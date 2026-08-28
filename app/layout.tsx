import type { Metadata } from 'next';
import { Roboto, Playfair_Display } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const playfair = Playfair_Display({
  weight: ['400'],
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
        className={`${roboto.className} ${playfair.variable} font-medium bg-[#FFFFFC] text-zinc-900 dark:bg-[#0a0a0a] dark:text-zinc-100 min-h-screen transition-colors duration-200`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
