import type { ExpenseCategory } from '@/lib/categories'

const LS_KEY = 'loot:merchant-categories'

/** Case-insensitive partial-match keyword ruleset — one entry per category. */
const RULES: Partial<Record<ExpenseCategory, string[]>> = {
  housing: ['rent', 'levy', 'body corp', 'municipal', 'rates and taxes', 'bond repayment', 'bond payment'],
  transport: ['uber', 'bolt', 'gautrain', 'myciti', 'taxify', 'metrorail', 'bus fare'],
  vehicle_finance: ['wesbank', 'motor finance', 'vehicle finance', 'vaf'],
  insurance: ['outsurance', 'discovery insure', 'santam', 'hollard', 'king price', 'momentum short', 'insurance premium'],
  medical_aid: ['discovery health', 'bonitas', 'momentum medical', 'medshield', 'medical aid', 'gems'],
  debt_repayments: ['capfin', 'african bank', 'loan repayment', 'personal loan', 'credit card payment'],
  groceries: ['checkers', 'pick n pay', 'picknpay', 'woolworths food', 'spar', 'shoprite', 'food lovers', 'usave'],
  eating_out: ['mcdonald', 'kfc', 'nandos', 'steers', 'debonairs', 'wimpy', 'restaurant', 'ocean basket', 'spur'],
  coffee_drinks: ['starbucks', 'vida e caffe', 'seattle coffee', 'mugg & bean', 'tashas'],
  household: ['builders warehouse', 'leroy merlin', 'game stores', 'makro household', 'home affairs'],
  clothing_shopping: ['mr price', 'edgars', 'woolworths clothing', 'cotton on', 'truworths', 'ackermans', 'jet stores'],
  health_beauty: ['clicks', 'dischem', 'dis-chem', 'sorbet', 'foschini beauty'],
  subscriptions: ['netflix', 'showmax', 'spotify', 'apple.com/bill', 'disney+', 'youtube premium', 'amazon prime', 'dstv'],
  entertainment: ['ster kinekor', 'nu metro', 'cinema', 'ticketpro', 'computicket'],
  tech_gadgets: ['incredible connection', 'istore', 'takealot electronics', 'evetech'],
  phone_airtime: ['vodacom', 'mtn', 'cell c', 'telkom mobile', 'airtime', 'rain mobile'],
  giving_charity: ['gift of the givers', 'charity', 'donation', 'ngo'],
  education: ['school fees', 'university', 'unisa', 'tuition', 'studytrust'],
  childcare: ['creche', 'daycare', 'nanny', 'aupair'],
  pets: ['vet ', 'veterinary', 'petsmart', 'animal clinic', 'pet food'],
  savings: ['savings transfer', 'stash', 'easyequities deposit'],
  investments: ['easyequities', 'satrix', 'allan gray', 'unit trust', 'sygnia', 'ninety one'],
  side_business: ['payfast', 'yoco', 'ozow settlement'],
  travel_holidays: ['flysafair', 'kulula', 'booking.com', 'airbnb', 'travelstart', 'sun international'],
  government_admin: ['sars', 'home affairs', 'traffic fine', 'licence renewal', 'e-toll'],
}

/** Reads the user's manual merchant → category overrides from localStorage. */
function readOverrides(): Record<string, ExpenseCategory> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** Saves a manual merchant → category assignment for future statements. */
export function setMerchantCategory(merchant: string, category: ExpenseCategory) {
  try {
    const overrides = readOverrides()
    overrides[normalizeMerchant(merchant)] = category
    localStorage.setItem(LS_KEY, JSON.stringify(overrides))
  } catch {
    // localStorage unavailable — degrade silently, this session just won't remember it
  }
}

function normalizeMerchant(description: string) {
  return description.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Classifies a transaction description into a category, or null if unclassified. */
export function categorizeTransaction(description: string): ExpenseCategory | null {
  const normalized = normalizeMerchant(description)

  const overrides = readOverrides()
  for (const [merchant, category] of Object.entries(overrides)) {
    if (normalized.includes(merchant)) return category
  }

  for (const [category, keywords] of Object.entries(RULES) as [ExpenseCategory, string[]][]) {
    if (keywords.some((kw) => normalized.includes(kw))) return category
  }

  return null
}
