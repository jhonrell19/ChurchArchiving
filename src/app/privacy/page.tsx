import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fffaf0] py-14 px-5">
      <article className="mx-auto max-w-3xl rounded-2xl border border-amber-100 bg-white p-8 shadow-sm space-y-5 text-slate-700">
        <h1 className="text-3xl font-semibold text-navy-mid">Smart Parish Privacy Notice</h1>
        <p>This system supports the parish's account management, church-record requests, archival services, and cemetery-related services.</p>
        <h2 className="text-xl font-semibold text-navy-mid">Information you provide</h2>
        <p>Account registration collects your first name, surname, and email address. Middle name and phone number are optional. You may add contact and address information to your profile. Requests for certificates or cemetery services may require additional details and documents relevant to that service.</p>
        <h2 className="text-xl font-semibold text-navy-mid">How information is used</h2>
        <p>Information is used for account authentication, email verification, parish-service requests, record matching, service communication, and payment processing where applicable. Staff access is restricted according to their assigned role.</p>
        <h2 className="text-xl font-semibold text-navy-mid">Service providers</h2>
        <p>Depending on enabled features, the system may use Google for account sign-in, Resend for email delivery, and PayMongo for online payments. These providers process the information required for their respective services.</p>
        <h2 className="text-xl font-semibold text-navy-mid">Questions and corrections</h2>
        <p>For questions about information held by the parish, or requests for corrections, contact the parish office directly. Official church records and financial transaction histories may require retention for parish operations.</p>
        <p className="text-sm text-slate-500">The parish should review this notice and its data-retention practices before public production use.</p>
        <Link href="/register" className="inline-block text-blue-700 underline">Return to registration</Link>
      </article>
    </main>
  )
}
