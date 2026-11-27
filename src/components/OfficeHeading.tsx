export default function OfficeHeading({ title, home = '/admin' }: { title: string; home?: string }) {
  return <header className="office-heading">
    <a href={home}><i className="ti ti-arrow-left" aria-hidden="true"/> Back to workspace</a>
    <h1>{title}</h1>
  </header>
}
