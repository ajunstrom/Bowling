import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bowling Side Action',
  description: 'League bracket and side contest management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
