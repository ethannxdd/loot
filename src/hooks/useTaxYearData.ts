import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NewTaxYearData, TaxYearData } from '@/lib/types'
import { useAuth } from './useAuth'

export function taxYearDataQueryKey(userId: string | undefined, taxYear: string) {
  return ['tax_year_data', userId, taxYear] as const
}

const emptyYearData = (taxYear: string): Omit<TaxYearData, 'id' | 'user_id' | 'created_at' | 'updated_at'> => ({
  tax_year: taxYear,
  ra_contributions: 0,
  medical_aid_contributions: 0,
  home_office_deduction: 0,
  travel_deduction: 0,
  travel_km: 0,
  donations: 0,
  professional_development: 0,
})

export function useTaxYearData(taxYear: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: taxYearDataQueryKey(user?.id, taxYear),
    queryFn: async (): Promise<TaxYearData> => {
      const { data, error } = await supabase
        .from('tax_year_data')
        .select('*')
        .eq('user_id', user!.id)
        .eq('tax_year', taxYear)
        .maybeSingle()
      if (error) throw error
      return (data as TaxYearData) ?? { id: '', user_id: user!.id, ...emptyYearData(taxYear), created_at: '', updated_at: '' }
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

export function useUpsertTaxYearData(taxYear: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: NewTaxYearData) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('tax_year_data')
        .upsert({ ...patch, user_id: user.id, tax_year: taxYear }, { onConflict: 'user_id,tax_year' })
        .select()
        .single()
      if (error) throw error
      return data as TaxYearData
    },
    onSuccess: (data) => queryClient.setQueryData(taxYearDataQueryKey(user?.id, taxYear), data),
  })
}
