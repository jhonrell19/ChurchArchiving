import type { Metadata } from 'next'
import './globals.css'
import Navbar from './components/Navbar' // Change this back to a regular import

export const metadata: Metadata = {
  title: 'Iglesia Filipina Independiente – Maragondon, Cavite',
  description: 'A heritage of faith, independence, and service since 1902.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      </head>
      <body suppressHydrationWarning>
        <Navbar />
        {children}
      </body>
    </html>
  )
}