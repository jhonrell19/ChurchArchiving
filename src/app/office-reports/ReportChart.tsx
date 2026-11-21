'use client'

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

export function ReportChart({ title, values }: {
  title: string
  values: { label: string, value: number }[]
}) {
  if (!values.length) return <p>No recorded data.</p>
  return <figure aria-label={title}>
    <div style={{ width: '100%', height: 210 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={values} margin={{ top: 12, right: 15, bottom: 8, left: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 14 }} minTickGap={20}/>
          <YAxis width={52} allowDecimals={false} tick={{ fontSize: 14 }}/>
          <Tooltip/>
          <Bar dataKey="value" name={title} fill="#985444" radius={[3,3,0,0]} isAnimationActive={false}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </figure>
}
