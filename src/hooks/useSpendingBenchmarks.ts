import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IncomeBracket } from '@/lib/money'
import type { SpendingBenchmark } from '@/lib/types'

/** Minimum sample size before benchmark data is shown — see LOOT-FEATURES.md Business Rule 14. */
export const BENCHMARK_MIN_SAMPLE = 50

export function useSpendingBenchmarks(bracket: IncomeBracket | undefined) {
  return useQuery({
    queryKey: ['spending_benchmarks', bracket],
    queryFn: async (): Promise<SpendingBenchmark[]> => {
      const { data, error } = await supabase
        .from('spending_benchmarks')
        .select('*')
        .eq('income_bracket', bracket!)
      if (error) throw error
      return data as SpendingBenchmark[]
    },
    enabled: Boolean(bracket),
    staleTime: 60_000,
  })
}
