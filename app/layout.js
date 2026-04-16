import './globals.css'

export const metadata = {
  title: 'TaskFlow — Jamo Operations',
  description: 'System zarzadzania zadaniami i reklamacjami',
  manifest: '/manifest.json',
  themeColor: '#ffffff',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'TaskFlow' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
