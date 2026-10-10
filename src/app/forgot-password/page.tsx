import Link from 'next/link'

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white/5 border border-gold/20 rounded-2xl p-10 text-center">
        <span className="block text-gold text-4xl mb-3">✝</span>
        <h1 className="font-display text-gold text-lg mb-3">Password Recovery</h1>
        <p className="font-body text-txt-md text-[13px] leading-relaxed mb-6">
          Email-based password recovery is not configured yet. Please contact the parish office so an authorized staff member can help reset your account.
        </p>
        <Link href="/login" className="text-gold/80 underline font-body text-[13px]">
          Back to Login
        </Link>
      </div>
    </div>
  )
}
