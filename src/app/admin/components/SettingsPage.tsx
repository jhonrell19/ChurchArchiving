'use client'

import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()

const logout = async () => {
  await fetch('/api/auth/logout', {
    method: 'POST',
  })

  router.push('/login')
}

  
  const fields = [
    { label: 'Parish Name', value: 'Iglesia Filipina Independiente', icon: 'ti-church'  },
    { label: 'Location',    value: 'Maragondon, Cavite',             icon: 'ti-map-pin' },
    { label: 'Admin Email', value: 'admin@ifi-maragondon.ph',        icon: 'ti-mail'    },
    { label: 'Admin Role',  value: 'Super Administrator',            icon: 'ti-shield'  },
  ]
  return (
    <div className="max-w-lg">
      <h2 className="font-display text-navy-mid text-xl font-semibold mb-1">Settings</h2>
      <p className="font-body text-[#6b8caa] text-[14px] mb-6">System and administrator account settings.</p>
      <div className="space-y-4">
        {fields.map(({ label, value, icon }) => (
          <div key={label} className="bg-white border border-gold/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <i className={`ti ${icon} text-gold text-[16px]`} aria-hidden="true" />
              <div>
                <p className="font-display text-[10px] tracking-wider text-[#9ab0c4] uppercase">{label}</p>
                <p className="font-body text-navy-mid text-[13px]">{value}</p>
              </div>
            </div>
            <button className="p-1.5 rounded-lg border border-gold/20 text-[#9ab0c4]"><i className="ti ti-edit text-[14px]" /></button>
          </div>
        ))}

        <button
  onClick={logout}
  className="font-display text-[11px] tracking-wider text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
>
  Logout
</button>
      </div>
    </div>
  )
}