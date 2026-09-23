import { ChevronDown, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { TaxProfile } from '@/lib/types'

interface Step {
  title: string
  body: string
}

function buildSteps(profile: TaxProfile | null): Step[] {
  const steps: Step[] = [
    {
      title: 'Register for eFiling',
      body: 'If you haven\'t already, register at efiling.sars.gov.za with your ID number and tax reference number.',
    },
  ]

  if (profile?.is_provisional_taxpayer === 'yes') {
    steps.push({
      title: 'Check your auto-assessment (if issued)',
      body: "As a provisional taxpayer you're less likely to be auto-assessed, but check your eFiling inbox in July regardless.",
    })
    steps.push({
      title: 'Submit your IRP6 provisional returns',
      body: 'File your first-period IRP6 by 31 August and your second-period IRP6 by the end of February, using the estimate above.',
    })
  } else {
    steps.push({
      title: 'Check your auto-assessment',
      body: 'SARS usually issues auto-assessments from early July. Log in to eFiling or the SARS MobiApp to see if you\'ve received one.',
    })
    steps.push({
      title: 'Accept or edit your assessment',
      body: 'If the numbers match your records, accept it. If you have deductions SARS doesn\'t know about (RA top-ups, donations, home office), edit the return to add them before filing.',
    })
  }

  steps.push({
    title: 'Gather your supporting documents',
    body: 'IRP5/IT3(a) certificates, medical aid tax certificate, RA contribution certificate, donation receipts (Section 18A), and a travel logbook if claiming travel.',
  })

  if (profile?.home_office_enabled === 'yes') {
    steps.push({
      title: 'Prepare your home office claim',
      body: 'Keep records of the room\'s area vs your home\'s total area, and receipts for rent/bond interest, electricity, and other running costs.',
    })
  }

  steps.push({
    title: 'Submit and pay (or wait for your refund)',
    body: "Submit via eFiling before your deadline. If you owe SARS money, pay via eFiling or your bank's SARS beneficiary. Refunds are usually paid within a few weeks if your banking details are up to date.",
  })

  return steps
}

export function EFilingGuide({ profile }: { profile: TaxProfile | null }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const steps = buildSteps(profile)

  return (
    <div className="card space-y-3 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="card-title">How to file with SARS</h3>
        <a
          href="https://www.sars.gov.za/individuals/how-do-i-submit-my-return/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[13px] font-semibold text-primary"
        >
          SARS eFiling <ExternalLink size={12} strokeWidth={1.75} />
        </a>
      </div>
      <div className="divide-y divide-hairline">
        {steps.map((step, i) => {
          const isOpen = openIndex === i
          return (
            <div key={step.title}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${
                    isOpen ? 'bg-primary text-primary-foreground' : 'bg-fill text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-[14.5px] font-semibold">{step.title}</span>
                <ChevronDown size={16} strokeWidth={2} className={`shrink-0 text-text-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && <p className="animate-enter pb-3 pl-10 text-[13.5px] leading-relaxed text-muted-foreground">{step.body}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
