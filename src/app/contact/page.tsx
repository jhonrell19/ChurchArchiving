'use client'

import { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Link from 'next/link'

const INFO = [
  { emoji: '📍', label: 'Address',             value: 'Poblacion 2-B, Maragondon, Cavite, Philippines' },
  { emoji: '🕐', label: 'Parish Office Hours', value: 'Monday – Friday, 8:00 AM – 5:00 PM' },
  { emoji: '✝️', label: 'Sunday Mass',         value: '8:00 AM · Morning Mass  |  10:00 AM · High Mass' },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const submit = (e: React.FormEvent) => { e.preventDefault(); setSent(true) }

  const inputCls = `w-full bg-white border border-navy-mid/20 rounded-lg px-4 py-3
    font-body text-[15px] text-navy outline-none
    focus:border-gold/60 transition-colors duration-200`

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative bg-navy pt-32 pb-20 px-7 text-center overflow-hidden border-b border-gold/15">
        <div className="absolute inset-0 bg-grid-gold pointer-events-none" />
        <div className="relative z-10 max-w-xl mx-auto animate-fade-down">
          <span className="block font-display text-[11px] tracking-[3px] uppercase text-gold/55 mb-4">
            Reach Out
          </span>
          <div className="text-gold text-4xl mb-4 animate-pulse-cross">✝</div>
          <h1
            className="font-display font-semibold text-gold mb-4"
            style={{ fontSize: 'clamp(22px,4vw,36px)' }}
          >
            Contact Us
          </h1>
          <p className="font-body italic text-txt-lt text-[16px] leading-relaxed mb-6">
            We would love to hear from you. Come worship with us or send us a message.
          </p>
          <div className="gold-divider"><span /><span className="diamond" /><span /></div>
        </div>
      </section>

      {/* Body */}
      <section className="py-20 px-7">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-14 items-start">

          {/* Info */}
          <div>
            <span className="block font-display text-[11px] tracking-[3px] uppercase text-navy-mid/45 mb-3">
              Find Us
            </span>
            <h2
              className="font-display font-semibold text-navy-mid mb-8"
              style={{ fontSize: 'clamp(18px,2.5vw,26px)' }}
            >
              Parish Information
            </h2>

            <div className="flex flex-col gap-7">
              {INFO.map(({ emoji, label, value }) => (
                <div key={label} className="flex gap-4 items-start">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-gold/8 border border-gold/25
                    flex items-center justify-center text-xl">
                    {emoji}
                  </div>
                  <div>
                    <p className="font-display text-[10px] tracking-[1.5px] uppercase text-navy-mid/45 mb-1">
                      {label}
                    </p>
                    <p className="font-body text-[15px] text-[#3a5a7a] leading-relaxed">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Map placeholder */}
            <div className="mt-9 bg-navy-mid rounded-xl border border-gold/20 h-44
              flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">📍</span>
              <p className="font-display text-[10px] tracking-widest uppercase text-gold/35">
                Map embed goes here
              </p>
            </div>
          </div>

          {/* Form */}
          <div>
            <span className="block font-display text-[11px] tracking-[3px] uppercase text-navy-mid/45 mb-3">
              Send a Message
            </span>
            <h2
              className="font-display font-semibold text-navy-mid mb-8"
              style={{ fontSize: 'clamp(18px,2.5vw,26px)' }}
            >
              Get in Touch
            </h2>

            {sent ? (
              <div className="bg-gold/8 border border-gold/30 rounded-xl p-10 text-center">
                <div className="text-4xl text-gold mb-4">✝</div>
                <p className="font-display text-navy-mid text-sm mb-3">Message Received</p>
                <p className="font-body text-[15px] text-[#3a5a7a] leading-relaxed">
                  Thank you for reaching out. A member of our parish office will get back to you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-5">
                <div>
                  <label className="block font-display text-[10px] tracking-[1.5px] uppercase text-navy-mid/45 mb-2">
                    Full Name
                  </label>
                  <input type="text" name="name" value={form.name} onChange={change}
                    placeholder="Juan dela Cruz" required className={inputCls} />
                </div>
                <div>
                  <label className="block font-display text-[10px] tracking-[1.5px] uppercase text-navy-mid/45 mb-2">
                    Email Address
                  </label>
                  <input type="email" name="email" value={form.email} onChange={change}
                    placeholder="juan@example.com" required className={inputCls} />
                </div>
                <div>
                  <label className="block font-display text-[10px] tracking-[1.5px] uppercase text-navy-mid/45 mb-2">
                    Subject
                  </label>
                  <select name="subject" value={form.subject} onChange={change} required className={inputCls}>
                    <option value="">Select a topic…</option>
                    <option>General Inquiry</option>
                    <option>Baptism Request</option>
                    <option>Marriage Inquiry</option>
                    <option>Burial Arrangements</option>
                    <option>Parish Records</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-display text-[10px] tracking-[1.5px] uppercase text-navy-mid/45 mb-2">
                    Message
                  </label>
                  <textarea name="message" value={form.message} onChange={change}
                    placeholder="Write your message here…" rows={5} required
                    className={`${inputCls} resize-y`} />
                </div>
                <button type="submit"
                  className="w-full font-display text-[11px] tracking-[2px] uppercase
                    bg-gold text-navy py-3.5 rounded-lg hover:bg-gold-lt
                    transition-colors duration-300 mt-2">
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}