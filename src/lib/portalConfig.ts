import { prisma } from './prisma'
export const portalEnabled = () => process.env.PARISH_PORTAL_SETTINGS === 'enabled'
export function isSupervisor(user:{id:number,role:string}|null) {
  return !!user && user.role==='ADMIN' && String(user.id)===process.env.PARISH_SUPER_ADMIN_ID
}
export async function readPolicy() {
  if (!portalEnabled()) return null
  const [row]=await prisma.$queryRaw<{id:string,body:string}[]>`SELECT id::text,body FROM parish_private.policy_version ORDER BY id DESC LIMIT 1`
  return row || null
}

export class PolicyChanged extends Error {}
export async function registerWithPolicy(data: import('@prisma/client').Prisma.UserCreateInput, version: unknown) {
  return prisma.$transaction(async tx => {
    const policy = portalEnabled() ? (await tx.$queryRaw<{id:bigint}[]>`SELECT id FROM parish_private.policy_version ORDER BY id DESC LIMIT 1`)[0] : null
    if (policy && String(policy.id)!==version) throw new PolicyChanged()
    const user=await tx.user.create({data})
    if(policy) await tx.$executeRaw`INSERT INTO parish_auth.policy_consent(user_id,version) VALUES (${user.id},${policy.id})`
    return user
  })
}
