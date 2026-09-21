import type { ExpenseCategory } from '@/lib/categories'

const LS_KEY = 'loot:merchant-categories'

/**
 * Keyword ruleset — one list per category. Keywords match whole words only ("rent" does not match
 * "current", "spar" does not match "transparent"), and when several categories match a description the
 * longest (most specific) keyword wins, so "woolworths clothing" beats plain "woolworths".
 */
const RULES: Partial<Record<ExpenseCategory, string[]>> = {
  housing: ['rent', 'levy', 'body corp', 'municipal', 'municipality', 'rates and taxes', 'bond repayment', 'bond payment', 'eskom', 'city power', 'prepaid electricity', 'home loan', 'homeloan'],
  transport: ['uber', 'bolt', 'gautrain', 'myciti', 'taxify', 'metrorail', 'bus fare', 'engen', 'sasol', 'caltex', 'shell', 'bp', 'total energies', 'petrol', 'fuel', 'parking', 'inDrive', 'toll'],
  vehicle_finance: ['wesbank', 'motor finance', 'vehicle finance', 'vaf', 'mfc', 'toyota finance', 'bmw finance'],
  insurance: ['outsurance', 'discovery insure', 'santam', 'hollard', 'king price', 'momentum short', 'insurance premium', 'old mutual', 'sanlam', 'liberty', 'clientele', 'assupol', 'pps'],
  medical_aid: ['discovery health', 'bonitas', 'momentum medical', 'medshield', 'medical aid', 'gems', 'medihelp', 'fedhealth', 'bestmed'],
  debt_repayments: ['capfin', 'african bank', 'loan repayment', 'personal loan', 'credit card payment', 'nedbank loan', 'sa home loans', 'mr price money', 'tymebank loan'],
  groceries: ['checkers', 'pick n pay', 'picknpay', 'pnp', 'woolworths food', 'spar', 'superspar', 'shoprite', 'food lovers', 'usave', 'boxer', 'cambridge food', 'ok foods', 'makro food'],
  eating_out: ['mcdonald', 'mcdonalds', 'kfc', 'nandos', 'steers', 'debonairs', 'wimpy', 'restaurant', 'ocean basket', 'spur', 'mr d food', 'uber eats', 'fishaways', 'chicken licken', 'pizza', 'sushi', 'burger', 'takeaway'],
  coffee_drinks: ['starbucks', 'vida e caffe', 'vida', 'seattle coffee', 'mugg & bean', 'mugg and bean', 'tashas', 'woolworths cafe', 'bootlegger', 'coffee', 'liquor', 'bottle store', 'tops'],
  household: ['builders warehouse', 'builders express', 'leroy merlin', 'game stores', 'game store', 'makro household', 'mrp home', 'coricraft', 'hirsch', 'sheet street', 'pep home', 'takealot home'],
  clothing_shopping: ['mr price', 'mrp', 'edgars', 'woolworths clothing', 'cotton on', 'truworths', 'ackermans', 'jet stores', 'pep stores', 'pep', 'foschini', 'shein', 'zara', 'h&m', 'sportscene', 'totalsports', 'markham', 'superbalist', 'takealot'],
  health_beauty: ['clicks', 'dischem', 'dis-chem', 'sorbet', 'foschini beauty', 'pharmacy', 'dentist', 'dental', 'salon', 'barber', 'gym', 'virgin active', 'planet fitness', 'optometrist', 'specsavers', 'pathcare', 'lancet', 'doctor'],
  subscriptions: ['netflix', 'showmax', 'spotify', 'apple.com/bill', 'apple com bill', 'itunes', 'google one', 'google play', 'disney+', 'disney plus', 'youtube premium', 'amazon prime', 'dstv', 'multichoice', 'openai', 'chatgpt', 'microsoft 365', 'adobe', 'icloud', 'playstation', 'xbox', 'audible', 'canva'],
  entertainment: ['ster kinekor', 'nu metro', 'cinema', 'ticketpro', 'computicket', 'webtickets', 'quicket', 'bowling', 'casino', 'hollywoodbets', 'betway', 'lottery', 'lotto'],
  tech_gadgets: ['incredible connection', 'istore', 'takealot electronics', 'evetech', 'wootware', 'computer mania', 'rebel computer', 'digicape'],
  phone_airtime: ['vodacom', 'mtn', 'cell c', 'telkom', 'telkom mobile', 'airtime', 'rain mobile', 'afrihost', 'vumatel', 'openserve', 'webafrica', 'fibre', 'data bundle', 'voucher vodacom'],
  giving_charity: ['gift of the givers', 'charity', 'donation', 'ngo', 'church', 'tithe', 'sponsor a child', 'section 18a'],
  education: ['school fees', 'university', 'unisa', 'tuition', 'studytrust', 'college', 'coursera', 'udemy', 'school', 'varsity'],
  childcare: ['creche', 'daycare', 'nanny', 'aupair', 'au pair', 'aftercare', 'babysitter'],
  pets: ['vet', 'veterinary', 'petsmart', 'animal clinic', 'pet food', 'pet shop', 'petworld', 'pets warehouse'],
  savings: ['savings transfer', 'stash', 'tyme vault', 'notice deposit', 'fixed deposit'],
  investments: ['easyequities', 'satrix', 'allan gray', 'unit trust', 'sygnia', 'ninety one', 'coronation', '10x', 'etf', 'retirement annuity', 'ra contribution', 'luno', 'valr'],
  side_business: ['payfast', 'yoco', 'ozow settlement', 'snapscan settlement', 'zapper settlement', 'invoice payment'],
  travel_holidays: ['flysafair', 'kulula', 'booking.com', 'airbnb', 'travelstart', 'sun international', 'lift airline', 'airlink', 'hotel', 'lodge', 'expedia', 'city lodge', 'protea hotel'],
  government_admin: ['sars', 'home affairs', 'traffic fine', 'licence renewal', 'license renewal', 'e-toll', 'sanral', 'cipc', 'dept of transport', 'natis'],
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whole-word regex for a keyword: not preceded or followed by a letter or digit. */
function keywordRegex(keyword: string): RegExp {
  // No lookbehind — older iOS WebViews don't support it.
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(keyword.toLowerCase())}(?![a-z0-9])`)
}

interface CompiledRule {
  category: ExpenseCategory
  keyword: string
  regex: RegExp
}

const COMPILED: CompiledRule[] = (Object.entries(RULES) as [ExpenseCategory, string[]][])
  .flatMap(([category, keywords]) => keywords.map((keyword) => ({ category, keyword: keyword.toLowerCase(), regex: keywordRegex(keyword) })))
  // Longest keyword first, so the first match found is the most specific one.
  .sort((a, b) => b.keyword.length - a.keyword.length)

const NOISE_WORDS = new Set([
  'pos', 'purchase', 'card', 'debit', 'credit', 'order', 'payment', 'pmt', 'eft', 'fnb', 'app', 'to', 'from', 'ref', 'reference',
  'contactless', 'online', 'cash', 'withdrawal', 'atm', 'internet', 'transfer', 'acb', 'ibank', 'the', 'stmt', 'no',
])

/**
 * Reduces a transaction description to a stable merchant key so a correction made once keeps working next
 * month, when the reference numbers, dates and card digits on the line are different:
 * "POS PURCHASE WOOLWORTHS 4821 17 JAN" → "woolworths".
 */
export function merchantKey(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?/g, ' ')
    .replace(/\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g, ' ')
    .replace(/[^a-z&+.'\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NOISE_WORDS.has(w))
  const key = words.slice(0, 3).join(' ').trim()
  return key || description.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Reads the user's manual merchant → category overrides from localStorage. */
function readOverrides(): Record<string, ExpenseCategory> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Saves a manual merchant → category assignment for future statements. */
export function setMerchantCategory(merchant: string, category: ExpenseCategory) {
  try {
    const overrides = readOverrides()
    overrides[merchantKey(merchant)] = category
    localStorage.setItem(LS_KEY, JSON.stringify(overrides))
  } catch {
    // localStorage unavailable — degrade silently, this session just won't remember it
  }
}

/** Forgets every saved merchant → category choice. */
export function clearMerchantCategories() {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // ignore
  }
}

/** How many merchant choices are currently remembered on this device. */
export function merchantOverrideCount(): number {
  return Object.keys(readOverrides()).length
}

/** Classifies a transaction description into a category, or null if unclassified. */
export function categorizeTransaction(description: string): ExpenseCategory | null {
  const key = merchantKey(description)
  const overrides = readOverrides()
  if (overrides[key]) return overrides[key]

  const normalized = description.toLowerCase().replace(/\s+/g, ' ').trim()
  for (const rule of COMPILED) {
    if (rule.regex.test(normalized)) return rule.category
  }
  return null
}
