import { beforeEach, describe, expect, it } from 'vitest'
import { categorizeTransaction, clearMerchantCategories, merchantKey, merchantOverrideCount, setMerchantCategory } from './categorize'

// A tiny in-memory localStorage — the tests run in node.
function stubStorage() {
  const data = new Map<string, string>()
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
  ;(globalThis as { localStorage?: unknown }).localStorage = storage
}

beforeEach(() => {
  stubStorage()
})

describe('categorizeTransaction', () => {
  it.each([
    ['POS PURCHASE WOOLWORTHS FOOD 1234', 'groceries'],
    ['CHECKERS SANDTON', 'groceries'],
    ['Pick n Pay Store', 'groceries'],
    ['UBER *TRIP HELP.UBER.COM', 'transport'],
    ['NETFLIX.COM', 'subscriptions'],
    ['DEBIT ORDER DISCOVERY HEALTH', 'medical_aid'],
    ['MONTHLY RENT PAYMENT', 'housing'],
    ['VODACOM AIRTIME', 'phone_airtime'],
    ['WESBANK VEHICLE FINANCE', 'vehicle_finance'],
    ['CLICKS PHARMACY', 'health_beauty'],
  ])('%s → %s', (description, category) => {
    expect(categorizeTransaction(description)).toBe(category)
  })

  it('only matches whole words', () => {
    expect(categorizeTransaction('CURRENT ACCOUNT ADJUSTMENT')).toBeNull() // "rent" inside "current"
    expect(categorizeTransaction('TRANSPARENT BILLING')).toBeNull() // "spar" inside "transparent"
    expect(categorizeTransaction('SPAR NEWTOWN')).toBe('groceries')
    expect(categorizeTransaction('rent')).toBe('housing')
  })

  it('the longest (most specific) keyword wins', () => {
    expect(categorizeTransaction('WOOLWORTHS CLOTHING SANDTON')).toBe('clothing_shopping')
    expect(categorizeTransaction('WOOLWORTHS FOOD SANDTON')).toBe('groceries')
    expect(categorizeTransaction('UBER EATS ORDER')).toBe('eating_out') // beats plain "uber"
  })

  it('returns null for unknown merchants', () => {
    expect(categorizeTransaction('ZZZ UNKNOWN SHOP 991')).toBeNull()
  })

  it('is case-insensitive and whitespace-tolerant', () => {
    expect(categorizeTransaction('  pick   n   pay  ')).toBe('groceries')
  })
})

describe('merchantKey', () => {
  it('strips noise, numbers and dates so the same merchant always gets the same key', () => {
    const a = merchantKey('POS PURCHASE WOOLWORTHS 4821 17 JAN')
    const b = merchantKey('POS PURCHASE WOOLWORTHS 9910 03/02')
    expect(a).toBe('woolworths')
    expect(b).toBe(a)
  })

  it('keeps at most three words', () => {
    expect(merchantKey('Big Blue Ocean Cafe Sandton Branch')).toBe('big blue ocean')
  })

  it('falls back to the raw text when everything is noise', () => {
    expect(merchantKey('1234 5678')).toBe('1234 5678')
  })
})

describe('manual overrides', () => {
  it('a saved choice beats the built-in rules and applies to later statements', () => {
    expect(categorizeTransaction('ZZZ UNKNOWN SHOP 991')).toBeNull()
    setMerchantCategory('ZZZ UNKNOWN SHOP 991', 'pets')
    expect(categorizeTransaction('ZZZ UNKNOWN SHOP 552 17 FEB')).toBe('pets')
    setMerchantCategory('CHECKERS SANDTON', 'household')
    expect(categorizeTransaction('CHECKERS SANDTON 1122')).toBe('household')
    expect(merchantOverrideCount()).toBe(2)
  })

  it('clearing forgets every choice', () => {
    setMerchantCategory('ZZZ UNKNOWN SHOP', 'pets')
    clearMerchantCategories()
    expect(merchantOverrideCount()).toBe(0)
    expect(categorizeTransaction('ZZZ UNKNOWN SHOP')).toBeNull()
  })

  it('survives corrupt storage and missing storage', () => {
    localStorage.setItem('loot:merchant-categories', '{not json')
    expect(categorizeTransaction('CHECKERS')).toBe('groceries')
    ;(globalThis as { localStorage?: unknown }).localStorage = undefined
    expect(() => setMerchantCategory('x', 'pets')).not.toThrow()
    expect(categorizeTransaction('CHECKERS')).toBe('groceries')
    expect(merchantOverrideCount()).toBe(0)
  })
})
