import './globals.css'

export const metadata = {
  title: 'TaskFlow - Jamo Operations',
  description: 'System zarzadzania zadaniami',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
