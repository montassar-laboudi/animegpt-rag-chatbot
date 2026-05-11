import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'AnimeGPT — Your Anime Expert',
  description: 'Chat with an AI anime expert for recommendations, character info, watch orders, and story summaries.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={inter.variable}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('anime-gpt-theme') || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {
                console.error('Failed to load theme:', e);
              }
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}