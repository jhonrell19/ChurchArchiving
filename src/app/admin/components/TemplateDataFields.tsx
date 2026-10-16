'use client'

import { inputCls } from '../data/ui'

export type MarriagePartyData = {
  first_name?: string
  middle_name?: string
  last_name?: string
  date_of_birth?: string
  age?: string
  place_of_birth?: string
  sex?: string
  citizenship?: string
  residence?: string
  religion?: string
  civil_status?: string
  father_first_name?: string
  father_middle_name?: string
  father_last_name?: string
  father_citizenship?: string
  mother_first_name?: string
  mother_middle_name?: string
  mother_last_name?: string
  mother_citizenship?: string
  consent_first_name?: string
  consent_middle_name?: string
  consent_last_name?: string
  consent_relationship?: string
  consent_residence?: string
}

export type TemplateRecordData = {
  date_of_baptism?: string
  date_of_confirmation?: string
  child_name?: string
  date_of_birth?: string
  place_of_birth?: string
  father_name?: string
  mother_name?: string
  address?: string
  contact_number?: string
  sponsors?: string[]

  husband?: MarriagePartyData
  wife?: MarriagePartyData
  place_of_marriage?: string
  marriage_city?: string
  marriage_province?: string
  date_of_marriage?: string
  time_of_marriage?: string
  witnesses?: string[]
}

type Props = {
  sacramentType: string
  value: TemplateRecordData
  onChange: (value: TemplateRecordData) => void
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block font-display text-[10px] tracking-wider text-navy-mid mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  )
}

function NamesRow({
  title,
  party,
  prefix,
  onPartyChange,
}: {
  title: string
  party: MarriagePartyData
  prefix: 'father' | 'mother' | 'consent'
  onPartyChange: (next: MarriagePartyData) => void
}) {
  const set = (key: keyof MarriagePartyData, value: string) =>
    onPartyChange({ ...party, [key]: value })

  const firstKey = `${prefix}_first_name` as keyof MarriagePartyData
  const middleKey = `${prefix}_middle_name` as keyof MarriagePartyData
  const lastKey = `${prefix}_last_name` as keyof MarriagePartyData

  return (
    <div className="md:col-span-3 rounded-lg border border-slate-200 p-3">
      <p className="font-display text-[10px] tracking-wider text-slate-600 mb-2">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Field label="First" value={String(party[firstKey] || '')} onChange={v => set(firstKey, v)} />
        <Field label="Middle" value={String(party[middleKey] || '')} onChange={v => set(middleKey, v)} />
        <Field label="Last" value={String(party[lastKey] || '')} onChange={v => set(lastKey, v)} />
      </div>
    </div>
  )
}

function MarriageParty({
  title,
  value,
  onChange,
}: {
  title: string
  value: MarriagePartyData
  onChange: (value: MarriagePartyData) => void
}) {
  const set = (key: keyof MarriagePartyData, fieldValue: string) =>
    onChange({ ...value, [key]: fieldValue })

  return (
    <div className="md:col-span-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <p className="font-display text-[11px] tracking-wider text-blue-800 mb-3">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="First Name" value={value.first_name || ''} onChange={v => set('first_name', v)} />
        <Field label="Middle Name" value={value.middle_name || ''} onChange={v => set('middle_name', v)} />
        <Field label="Last Name" value={value.last_name || ''} onChange={v => set('last_name', v)} />
        <Field label="Date of Birth" type="date" value={value.date_of_birth || ''} onChange={v => set('date_of_birth', v)} />
        <Field label="Age" value={value.age || ''} onChange={v => set('age', v)} />
        <Field label="Place of Birth" value={value.place_of_birth || ''} onChange={v => set('place_of_birth', v)} />
        <Field label="Sex" value={value.sex || ''} onChange={v => set('sex', v)} />
        <Field label="Citizenship" value={value.citizenship || ''} onChange={v => set('citizenship', v)} />
        <Field label="Civil Status" value={value.civil_status || ''} onChange={v => set('civil_status', v)} />
        <div className="md:col-span-2">
          <Field label="Residence" value={value.residence || ''} onChange={v => set('residence', v)} />
        </div>
        <Field label="Religion / Religious Sect" value={value.religion || ''} onChange={v => set('religion', v)} />

        <NamesRow title="Father's Name" party={value} prefix="father" onPartyChange={onChange} />
        <Field label="Father Citizenship" value={value.father_citizenship || ''} onChange={v => set('father_citizenship', v)} />
        <div className="md:col-span-2" />

        <NamesRow title="Mother's Maiden Name" party={value} prefix="mother" onPartyChange={onChange} />
        <Field label="Mother Citizenship" value={value.mother_citizenship || ''} onChange={v => set('mother_citizenship', v)} />
        <div className="md:col-span-2" />

        <NamesRow title="Person Who Gave Consent / Advice (if applicable)" party={value} prefix="consent" onPartyChange={onChange} />
        <Field label="Relationship" value={value.consent_relationship || ''} onChange={v => set('consent_relationship', v)} />
        <div className="md:col-span-2">
          <Field label="Residence of Person Giving Consent / Advice" value={value.consent_residence || ''} onChange={v => set('consent_residence', v)} />
        </div>
      </div>
    </div>
  )
}

export default function TemplateDataFields({ sacramentType, value, onChange }: Props) {
  const set = (key: keyof TemplateRecordData, fieldValue: string | string[]) =>
    onChange({ ...value, [key]: fieldValue })

  if (sacramentType === 'baptismal' || sacramentType === 'confirmation') {
    const sponsors = value.sponsors || []
    return (
      <div className="md:col-span-3 mt-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
        <p className="font-display text-[11px] tracking-wider text-emerald-800 mb-1">
          Official Form Data
        </p>
        <p className="font-body text-[11px] text-slate-600 mb-4">
          These verified archive facts are used to auto-fill the parish {sacramentType === 'baptismal' ? 'Baptism' : 'Confirmation'} form.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sacramentType === 'confirmation' && (
            <Field label="Date of Confirmation" type="date" value={value.date_of_confirmation || ''} onChange={v => set('date_of_confirmation', v)} />
          )}
          <Field label="Date of Baptism" type="date" value={value.date_of_baptism || ''} onChange={v => set('date_of_baptism', v)} />
          <Field label="Name of Child" value={value.child_name || ''} onChange={v => set('child_name', v)} />
          <Field label="Date of Birth" type="date" value={value.date_of_birth || ''} onChange={v => set('date_of_birth', v)} />
          <Field label="Place of Birth" value={value.place_of_birth || ''} onChange={v => set('place_of_birth', v)} />
          <Field label="Name of Father" value={value.father_name || ''} onChange={v => set('father_name', v)} />
          <Field label="Name of Mother" value={value.mother_name || ''} onChange={v => set('mother_name', v)} />
          <Field label="Address" value={value.address || ''} onChange={v => set('address', v)} />
          <Field label="Contact #" value={value.contact_number || ''} onChange={v => set('contact_number', v)} />
          <div className="md:col-span-3">
            <label className="block font-display text-[10px] tracking-wider text-navy-mid mb-1">Sponsors (one name per line, up to 10)</label>
            <textarea
              rows={4}
              value={sponsors.join('\n')}
              onChange={event => set('sponsors', event.target.value.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 10))}
              className={`${inputCls} resize-y`}
              placeholder={'Sponsor 1\nSponsor 2\nSponsor 3'}
            />
          </div>
        </div>
      </div>
    )
  }

  if (sacramentType === 'marriage') {
    return (
      <div className="md:col-span-3 mt-2 rounded-xl border border-violet-100 bg-violet-50/30 p-4">
        <p className="font-display text-[11px] tracking-wider text-violet-800 mb-1">Marriage Form Data</p>
        <p className="font-body text-[11px] text-slate-600 mb-4">
          The generator fills factual fields on the front of Municipal Form No. 97. Signatures, certification checkboxes, registry actions, sworn affidavits, and delayed-registration declarations remain blank for authorized manual completion.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MarriageParty
            title="Husband"
            value={value.husband || {}}
            onChange={party => onChange({ ...value, husband: party })}
          />
          <MarriageParty
            title="Wife"
            value={value.wife || {}}
            onChange={party => onChange({ ...value, wife: party })}
          />

          <Field label="Place of Marriage" value={value.place_of_marriage || ''} onChange={v => set('place_of_marriage', v)} />
          <Field label="City / Municipality" value={value.marriage_city || ''} onChange={v => set('marriage_city', v)} />
          <Field label="Province" value={value.marriage_province || ''} onChange={v => set('marriage_province', v)} />
          <Field label="Date of Marriage" type="date" value={value.date_of_marriage || ''} onChange={v => set('date_of_marriage', v)} />
          <Field label="Time of Marriage" value={value.time_of_marriage || ''} onChange={v => set('time_of_marriage', v)} placeholder="10:00 AM" />
          <div />

          <div className="md:col-span-3">
            <label className="block font-display text-[10px] tracking-wider text-navy-mid mb-1">Witness Printed Names (one per line)</label>
            <textarea
              rows={3}
              value={(value.witnesses || []).join('\n')}
              onChange={event => set('witnesses', event.target.value.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 6))}
              className={`${inputCls} resize-y`}
            />
          </div>
        </div>
      </div>
    )
  }

  return null
}
