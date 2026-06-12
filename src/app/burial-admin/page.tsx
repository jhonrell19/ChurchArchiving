'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BurialArchivesPage from '../admin/components/BurialArchivesPage'
import BurialRequestsPage from '../admin/components/BurialRequestsPage'
import RecycleBinPage from '../admin/components/RecycleBinPage'

type BurialPage = 'archives' | 'requests' | 'recycle'

export default function BurialAdminPage() {
  const [page, setPage] = useState<BurialPage>('archives')
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
    })

    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#f7f3ea] flex">
      <aside className="w-64 bg-navy text-white min-h-screen p-5 flex flex-col">
        <div className="mb-8">
          <p className="text-gold text-xl mb-1">✝</p>
          <h1 className="font-display text-gold text-[14px] tracking-wide">
            Smart Parish System
          </h1>
          <p className="font-body text-[11px] text-white/50">
            Burial Admin Panel
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setPage('archives')}
            className={`w-full text-left px-4 py-2 rounded-lg font-display text-[12px] ${
              page === 'archives'
                ? 'bg-gold text-navy'
                : 'text-white/70 hover:bg-white/10'
            }`}
          >
            Burial Archives
          </button>

          <button
            onClick={() => setPage('requests')}
            className={`w-full text-left px-4 py-2 rounded-lg font-display text-[12px] ${
              page === 'requests'
                ? 'bg-gold text-navy'
                : 'text-white/70 hover:bg-white/10'
            }`}
          >
            Burial Office Requests
          </button>
        </div>

<button
  onClick={() => setPage('recycle')}
  className={`w-full text-left px-4 py-2 rounded-lg font-display text-[12px] ${
    page === 'recycle'
      ? 'bg-gold text-navy'
      : 'text-white/70 hover:bg-white/10'
  }`}
>
  Recycle Bin
</button>

        <button
          onClick={logout}
          className="mt-auto w-full text-left px-4 py-2 rounded-lg font-display text-[12px] text-red-300 border border-red-400/30 hover:bg-red-500/10"
        >
          Logout
        </button>
      </aside>

      <main className="flex-1 p-6">
  {page === 'archives' && <BurialArchivesPage />}
  {page === 'requests' && <BurialRequestsPage />}
  {page === 'recycle' && <RecycleBinPage scope="burial" />}
</main>
    </div>
  )
}