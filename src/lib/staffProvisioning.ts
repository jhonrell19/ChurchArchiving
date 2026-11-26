// Staff accounts can be approved in person by the Super Admin. Keep inbox
// ownership separate so email recovery never treats an assigned login as verified.
export const STAFF_PROVISIONED = 'staff_provisioned'

export function supervisorProvisioned(user: { role: string; membershipStatus: string }) {
  return user.role === 'STAFF' && user.membershipStatus === STAFF_PROVISIONED
}
