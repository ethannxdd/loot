import { AlertTriangle, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react'
import type { AffordabilityVerdict } from './types'

export const VERDICT_META: Record<
  AffordabilityVerdict,
  { label: string; icon: LucideIcon; colorClass: string; dotClass: string }
> = {
  comfortable: {
    label: 'Comfortable',
    icon: CheckCircle2,
    colorClass: 'text-primary',
    dotClass: 'bg-primary',
  },
  tight: {
    label: 'Tight',
    icon: AlertTriangle,
    colorClass: 'text-caution',
    dotClass: 'bg-caution',
  },
  'not-recommended': {
    label: 'Not recommended',
    icon: XCircle,
    colorClass: 'text-alert',
    dotClass: 'bg-alert',
  },
}
