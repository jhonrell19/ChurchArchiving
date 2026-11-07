'use client'

import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/max'

const englishNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countries = getCountries()
  .map(code => ({ code, name: englishNames.of(code) || code, dial: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name))

type Props = {
  country: string
  phoneNumber: string
  onCountryChange: (value: string) => void
  onPhoneChange: (value: string) => void
  inputClass: string
  required?: boolean
}

export default function InternationalPhoneField({ country, phoneNumber, onCountryChange, onPhoneChange, inputClass, required = false }: Props) {
  const selected = countries.find(item => item.code === country)
  return (
    <div className="space-y-2">
      <label htmlFor="phone-country" className="block text-sm font-semibold text-navy-mid">Phone country / calling code</label>
      <select id="phone-country" value={country} onChange={event => { onCountryChange(event.target.value); onPhoneChange('') }} className={inputClass}>
        {countries.map(item => <option key={item.code} value={item.code}>{item.name} (+{item.dial})</option>)}
      </select>
      <label htmlFor="registration-phone" className="block text-sm font-semibold text-navy-mid">Mobile / contact number {required ? '*' : '(optional)'}</label>
      <input id="registration-phone" type="tel" value={phoneNumber} required={required} maxLength={40}
        onChange={event => onPhoneChange(event.target.value)} autoComplete="tel" inputMode="tel"
        placeholder={country === 'PH' ? '09171234567' : `+${selected?.dial || ''} ...`}
        className={inputClass} />
      <p className="text-xs text-slate-500">Country-specific number format is checked. SMS ownership verification is not yet enabled.</p>
    </div>
  )
}
