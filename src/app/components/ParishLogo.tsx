import Image from 'next/image'

type ParishLogoProps = {
  height?: number
  className?: string
}

/** Preserve the original IFI crest's portrait proportions. */
export default function ParishLogo({
  height = 48,
  className = '',
}: ParishLogoProps) {
  return (
    <Image
      src="/images/ifi-logo.png"
      alt="Iglesia Filipina Independiente official emblem"
      width={Math.round((height * 392) / 510)}
      height={height}
      className={`shrink-0 object-contain ${className}`}
    />
  )
}
