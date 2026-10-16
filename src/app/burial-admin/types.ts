export type CemeterySlot = {
  id: number
  section: string | null
  block: string | null
  lotNumber: string
  slotCode: string
  lotType: string
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED'
  rightsHolderName: string | null
  rightsHolderAddress: string | null
  rightsHolderContact: string | null
  mapLabel: string | null
  notes: string | null
  burialCount: number
  burials: { id: number; deceasedName: string; burialDate: string | null }[]
}

export type CemeteryPayment = {
  id: number
  reservationId: number
  amount: number
  paymentType: string
  paymentMethod: string
  receiptNumber: string | null
  paymentDate: string | null
  notes: string | null
  recordedBy: string | null
  createdAt: string | null
}

export type CemeteryReservation = {
  id: number
  raNumber: string | null
  reservationDate: string | null
  buyerName: string
  buyerAddress: string | null
  buyerContact: string | null
  civilStatus: string | null
  spouseName: string | null
  slotId: number
  slot: CemeterySlot | null
  paymentPlan: string
  totalPrice: number
  reservationFee: number
  requiredDownPayment: number
  termMonths: number | null
  monthlyAmortization: number | null
  dueDate: string | null
  status: string
  paymentStatus: string
  amountPaid: number
  balance: number
  contractFile: string | null
  notes: string | null
  payments: CemeteryPayment[]
}

export type BurialRecord = {
  id: number
  slotId: number
  slot: CemeterySlot | null
  deceasedName: string
  burialDate: string | null
  deathCertificateNumber: string | null
  deathCertificateFile: string | null
  burialPermitFile: string | null
  authorizationFile: string | null
  deceasedDetails: Record<string, unknown>
  notes: string | null
  status: string
}
