import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error — plain .mjs script, no types
import { expected } from '../../../scripts/sync-shared.mjs'

describe('supabase/functions/_shared/lib', () => {
  for (const f of expected() as { name: string; out: string; content: string }[]) {
    it(`${f.name}.ts matches src/lib (run npm run sync-shared)`, () => {
      expect(readFileSync(f.out, 'utf8')).toBe(f.content)
    })
  }
})
