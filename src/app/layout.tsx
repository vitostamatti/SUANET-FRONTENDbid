//layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import ClientLayout from './client-layout';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Suanet',
  description: 'Aplicación de estadistica y análisis de incidentes',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // CSP/nonce handling removed for video streaming compatibility

  return (
    <html lang="en">
      <head>
      </head>
      <body className={`layout ${inter.className}`}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
