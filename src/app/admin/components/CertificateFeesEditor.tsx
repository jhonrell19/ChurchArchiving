
'use client'

import { useEffect, useState } from 'react'

const FEE_FIELDS = [
  { code: 'baptismal', label: 'Baptismal Certificate' },
  { code: 'confirmation', label: 'Confirmation Certificate' },
  { code: 'marriage', label: 'Marriage Certificate' },
  { code: 'ownership', label: 'Certificate of Ownership' },
  { code: 'land_agreement', label: 'Land Agreement' },
  { code: 'urgent', label: 'Urgent Processing Surcharge' },
] as const

type FeeCode = (typeof FEE_FIELDS)[number]['code']
type FeeInputs = Record<FeeCode, string>

const API = '/api/backend/api/requests/pricing'

export default function CertificateFeesEditor() {
  const [values, setValues] = useState<FeeInputs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadFees() {
      try {
        const response = await fetch(API, {
          cache: 'no-store',
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load fees.')
        }

        const catalog = {
          ...data.fees,
          urgent: data.urgentFee,
        }

        const loaded = {} as FeeInputs

        for (const field of FEE_FIELDS) {
          const amount = catalog[field.code]

          if (!Number.isSafeInteger(amount) || amount < 0) {
            throw new Error('Invalid stored fee schedule.')
          }

          loaded[field.code] = String(amount)
        }

        if (active) setValues(loaded)
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Unable to load fees.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadFees()

    return () => {
      active = false
    }
  }, [])

  const saveFees = async () => {
    if (!values || saving) return

    setMessage('')
    setError('')

    const fees: Record<string, number> = {}

    for (const field of FEE_FIELDS) {
      const raw = values[field.code].trim()

      if (!/^\d+$/.test(raw)) {
        setError(`Enter a valid whole-peso amount for ${field.label}.`)
        return
      }

      const amount = Number(raw)

      if (
        !Number.isSafeInteger(amount) ||
        amount < 0 ||
        amount > 1000000
      ) {
        setError(`Invalid amount for ${field.label}.`)
        return
      }

      fees[field.code] = amount
    }

    setSaving(true)

    try {
      const response = await fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fees }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Save failed.')
      }

      setMessage('Certificate request prices updated successfully.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save prices.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-gold/20 bg-white p-5">
      <h3 className="font-display text-lg font-semibold text-navy-mid">
        Certificate Request Fees
      </h3>

      <p className="mt-2 mb-5 text-sm text-slate-600">
        Manage the published request fees. Changes apply to new
        requests only. Existing payment amounts are preserved.
      </p>

      {loading && (
        <p className="text-sm text-slate-600">Loading fees...</p>
      )}

      {values && (
        <div className="space-y-4">
          {FEE_FIELDS.map(field => (
            <div
              key={field.code}
              className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3"
            >
              <label
                htmlFor={`fee-${field.code}`}
                className="text-sm font-medium text-navy-mid"
              >
                {field.label}
              </label>

              <div className="flex items-center gap-2">
                <span className="text-slate-600">₱</span>
                <input
                  id={`fee-${field.code}`}
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  value={values[field.code]}
                  onChange={event => {
                    setValues(previous => previous ? {
                      ...previous,
                      [field.code]: event.target.value,
                    } : previous)
                  }}
                  className="w-28 rounded-lg border border-slate-300 p-2 text-right text-sm text-navy-mid"
                />
              </div>
            </div>
          ))}

          <p className="text-xs text-slate-500">
            A zero price keeps the category without an approved
            positive online-payment fee. It does not automatically
            authorize free document release.
          </p>

          <button
            type="button"
            disabled={saving}
            onClick={saveFees}
            className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-gold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  )
}
