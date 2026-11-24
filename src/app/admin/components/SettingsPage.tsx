'use client'

import type { ReactNode } from 'react'
import CertificateFeesEditor from './CertificateFeesEditor'

function SettingsRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="border-b border-slate-200 last:border-b-0">
      <summary className="cursor-pointer px-5 py-4 text-lg font-semibold focus-visible:outline-2">
        {title}
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  )
}

type SettingsProps = { manageWebsite: boolean; managePolicy: boolean; accountEmail: string }

export default function SettingsPage({ manageWebsite, managePolicy, accountEmail }: SettingsProps) {
  return (
    <section aria-label="Admin settings" className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white">
      <SettingsRow title="Certificate fees">
        <CertificateFeesEditor />
      </SettingsRow>
      {manageWebsite && <SettingsRow title="Website content management">
        <p>Update the homepage, weekly services, parish contact details and parish history.</p>
        <a className="mt-2 inline-block py-2 font-semibold underline" href="/admin/site-content">Manage website content</a>
      </SettingsRow>}
      {managePolicy && <SettingsRow title="Privacy policies and request purposes">
        <a className="inline-block py-2 font-semibold underline" href="/admin/portal-settings">Manage policies and purposes</a>
      </SettingsRow>}
      <SettingsRow title="Parish and account information">
        <table className="w-full text-left">
          <caption className="sr-only">Parish and signed-in administrator</caption>
          <tbody>
            {[
              ['Parish', 'Iglesia Filipina Independiente'],
              ['Location', 'Maragondon, Cavite'],
              ['Signed-in account', accountEmail],
              ['Role', 'Super Administrator'],
            ].map(([label, value]) => (
              <tr key={label} className="border-b border-slate-100">
                <th scope="row" className="py-3 pr-4 font-medium">{label}</th>
                <td className="break-words py-3 [overflow-wrap:anywhere]">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsRow>
    </section>
  )
}
