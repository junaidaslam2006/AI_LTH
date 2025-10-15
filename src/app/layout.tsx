
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'AI-LTH: Your Health, Explained Simply',
  description:
    'AI-powered health assistant for clear, accessible medical information.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('font-sans antialiased')}>
        <ThemeProvider>
            {children}
            <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
