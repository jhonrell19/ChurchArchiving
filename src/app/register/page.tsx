import { redirect } from 'next/navigation'

// Account registration is now on the public homepage. Preserve old bookmarks.
export default function RegisterPage() {
  redirect('/?auth=register#parish-access')
}
