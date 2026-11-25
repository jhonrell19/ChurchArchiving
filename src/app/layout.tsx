import type { Metadata } from 'next'
import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import './globals.css'
import ApiWorkspace from '@/components/ApiWorkspace'
import Navbar from './components/Navbar'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import SessionHistoryGuard from '@/components/auth/SessionHistoryGuard'

export const metadata: Metadata = {
  title: 'Iglesia Filipina Independiente – Maragondon, Cavite',
  description: 'A heritage of faith, independence, and service since 1902.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <FeedbackProvider>
          <SessionHistoryGuard />
          <Navbar />
          <ApiWorkspace>{children}</ApiWorkspace>
        </FeedbackProvider>
      </body>
    </html>
  )
}