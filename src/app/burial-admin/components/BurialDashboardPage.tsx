'use client'

export default function BurialDashboardPage({
  navigate,
}: {
  navigate: (page: 'dashboard' | 'burials' | 'requests' | 'archives') => void
}) {
  const sections = [
    { id: 'burials' as const, title: 'Burial and deceased records', description: 'Review burial details and historical records.', icon: 'ti-file-text' },
    { id: 'requests' as const, title: 'Document requests', description: 'Review burial-related document requests in your assigned scope.', icon: 'ti-inbox' },
    { id: 'archives' as const, title: 'Land agreements and ownership', description: 'Find and review protected burial-related archive scans.', icon: 'ti-archive' },
  ]
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h1 className="text-2xl font-semibold text-emerald-950">Burial document office</h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-emerald-900">
          This workspace manages historical burial records, ownership evidence and land agreements.
          Cemetery lot reservations, slots and payment operations are no longer offered in this interface.
          Existing financial and historical records are retained for authorized reconciliation.
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map(section => (
          <button key={section.id} type="button" onClick={() => navigate(section.id)}
            className="min-h-48 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-colors hover:border-emerald-500 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2">
            <i aria-hidden="true" className={`ti ${section.icon} text-3xl text-emerald-700`} />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{section.title}</h2>
            <p className="mt-2 text-base text-slate-600">{section.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
