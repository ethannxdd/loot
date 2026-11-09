// Generates a VAPID key pair for Web Push (Phase 6 B2). Run once: `npm run vapid`.
//   VITE_VAPID_PUBLIC_KEY  → Vercel env var + .env.local (the browser subscribes with it)
//   VAPID_PRIVATE_JWK      → Supabase edge secret (push-dispatch signs with it). Never commit it.
import { webcrypto as crypto } from 'node:crypto'

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const raw = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey))
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
const publicKey = raw.toString('base64url')

console.log('\nVITE_VAPID_PUBLIC_KEY=' + publicKey)
console.log('\nVAPID_PRIVATE_JWK=' + JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }))
console.log('\nSet them with:')
console.log(`  npx supabase secrets set VAPID_PRIVATE_JWK='${JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d })}' VAPID_SUBJECT=mailto:you@example.com`)
console.log('  and add VITE_VAPID_PUBLIC_KEY to Vercel (Production + Preview) and .env.local.\n')
