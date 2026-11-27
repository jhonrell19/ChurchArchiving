export function ReportChart({ title, values, currency = false }: {
  title: string
  values: { label: string; value: number }[]
  currency?: boolean
}) {
  if (!values.length) return <p>No recorded data.</p>
  const maximum = Math.max(1, ...values.map(row => row.value))
  const format = new Intl.NumberFormat('en-PH', currency ? { style: 'currency', currency: 'PHP' } : {})
  return <figure className="comparison-chart">
    <figcaption><span aria-hidden="true" />{title}</figcaption>
    <ul>{values.map(row => <li key={row.label}>
      <span>{row.label.replaceAll('_', ' ')}</span>
      <div aria-hidden="true"><i style={{ width: (100 * row.value / maximum) + '%' }}/></div>
      <strong>{format.format(row.value)}</strong>
    </li>)}</ul>
  </figure>
}
