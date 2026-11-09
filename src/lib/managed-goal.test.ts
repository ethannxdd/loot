import { describe, expect, it } from 'vitest'
import { makeGoal } from '@/test/factories'
import { isManagedGoal, managedBy } from './goal-math'

const NOTE = 'Target set by Northbound. It updates when your plan changes; your savings are never touched.'

describe('managedBy', () => {
  it('is null for an ordinary goal', () => {
    expect(managedBy(makeGoal())).toBeNull()
    expect(isManagedGoal(makeGoal({ note: 'Three months of expenses' }))).toBe(false)
  })

  it('reads the managed_by column', () => {
    expect(managedBy(makeGoal({ managed_by: 'northbound' }))).toBe('northbound')
    expect(managedBy(makeGoal({ managed_by: ' Northbound ', note: 'renamed note' }))).toBe('northbound')
  })

  it("falls back to Northbound's note for goals made before the column existed", () => {
    expect(managedBy(makeGoal({ note: NOTE }))).toBe('northbound')
    expect(managedBy(makeGoal({ note: NOTE, managed_by: null }))).toBe('northbound')
  })

  it('does not match the phrase elsewhere in a note, or an unknown manager', () => {
    expect(managedBy(makeGoal({ note: 'Not the Target set by Northbound. thing' }))).toBeNull()
    expect(managedBy(makeGoal({ managed_by: 'someapp' }))).toBeNull()
    expect(managedBy(makeGoal({ managed_by: 'someapp', note: NOTE }))).toBeNull()
  })
})
