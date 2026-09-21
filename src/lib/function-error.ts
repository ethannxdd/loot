import { FunctionsHttpError } from '@supabase/supabase-js'

/**
 * supabase-js's `functions.invoke` throws a `FunctionsHttpError` with just the generic
 * message "Edge Function returned a non-2xx status code" for any non-2xx response — the
 * actual reason (e.g. "GEMINI_API_KEY is not configured") is in the response body, on
 * `error.context`. This unwraps it so it actually reaches the UI instead of that opaque
 * wrapper message.
 */
export async function describeFunctionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Something went wrong.'
  if (!(error instanceof FunctionsHttpError)) return fallback
  try {
    const body = await error.context.clone().json()
    return typeof body?.error === 'string' ? body.error : fallback
  } catch {
    return fallback
  }
}

/** True when the edge function isn't deployed on this Supabase project (gateway answers 404 NOT_FOUND). */
export function isFunctionMissing(error: unknown): boolean {
  return error instanceof FunctionsHttpError && error.context.status === 404
}
