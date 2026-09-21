export interface GlossaryTerm {
  term: string
  definition: string
}

export const TAX_GLOSSARY: GlossaryTerm[] = [
  { term: 'Assessment year / Year of assessment', definition: "SARS's term for the tax year — 1 March to the end of February. The 2025/26 year of assessment runs 1 March 2025 to 28 February 2026." },
  { term: 'Auto-assessment', definition: 'SARS pre-fills a tax return using data from employers, banks and other sources. You can accept it as-is or edit and file your own return.' },
  { term: 'eFiling', definition: "SARS's free online portal for submitting returns, making payments and communicating with SARS: efiling.sars.gov.za." },
  { term: 'Gross income', definition: 'Total income before any deductions — salary, bonuses, allowances, investment income, and so on.' },
  { term: 'Taxable income', definition: 'Gross income minus allowable deductions (retirement contributions, donations, etc.) — the amount tax is actually calculated on.' },
  { term: 'PAYE (Pay-As-You-Earn)', definition: 'Employees Tax your employer deducts from your salary each month and pays to SARS on your behalf.' },
  { term: 'Provisional tax', definition: 'A system for taxpayers with income not fully covered by PAYE (freelance, rental, investment income) to pay tax in two (or three) instalments during the year rather than one lump sum.' },
  { term: 'IRP5', definition: 'The certificate your employer issues showing your annual income and PAYE deducted — used to complete your tax return.' },
  { term: 'IRP6', definition: 'The provisional tax return form submitted via eFiling for each provisional tax period.' },
  { term: 'Primary rebate', definition: 'A fixed amount subtracted from your calculated tax, available to every taxpayer regardless of age.' },
  { term: 'Secondary / tertiary rebate', definition: 'Additional rebates for taxpayers aged 65+ (secondary) and 75+ (tertiary), on top of the primary rebate.' },
  { term: 'Tax threshold', definition: "The income level below which you don't owe any income tax, once rebates are applied." },
  { term: 'Medical scheme fees tax credit', definition: 'A fixed monthly rebate (not a deduction) for belonging to a registered medical scheme, based on the number of people covered.' },
  { term: 'Retirement annuity (RA)', definition: 'A retirement savings product whose contributions are tax-deductible up to 27.5% of income, capped at a rand ceiling that SARS sets each year.' },
  { term: 'Section 11F deduction', definition: 'The legal section governing the retirement contribution deduction — the 27.5%-of-income rule capped at a rand ceiling.' },
  { term: 'Travel allowance', definition: 'An allowance from your employer for business travel. A logbook is required to claim the business-use portion as a deduction.' },
  { term: 'Home office deduction', definition: "A deduction for a portion of home running costs (rent, electricity, etc.) proportional to the office's share of your home's total area, if you regularly and mainly work from a dedicated home office." },
  { term: 'Effective tax rate', definition: 'Your total tax liability as a percentage of your gross income — usually lower than your marginal rate because of the progressive bracket system.' },
  { term: 'Marginal tax rate', definition: 'The tax rate applied to your next rand of income — the rate for the bracket your taxable income currently falls into.' },
  { term: 'Refund / amount owing', definition: 'The difference between tax already paid (via PAYE or provisional tax) and your final calculated liability — a refund if you overpaid, an amount owing if you underpaid.' },
]
