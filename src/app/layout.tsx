import type { Metadata } from 'next'
import './globals.css'
import Navbar from './Components/Navbar' // Change this back to a regular import

export const metadata: Metadata = {
  title: 'Iglesia Filipina Independiente – Maragondon, Cavite',
  description: 'A heritage of faith, independence, and service since 1902.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      </head>
      <body suppressHydrationWarning>
        <Navbar />
        {children}
      </body>
    </html>
  )
}