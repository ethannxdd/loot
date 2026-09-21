import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { describeFunctionError } from '@/lib/function-error'
import { supabase } from '@/lib/supabase'
import type { AssistantConversation, AssistantMessage } from '@/lib/types'
import { useAuth } from './useAuth'

export function conversationsQueryKey(userId: string | undefined) {
  return ['assistant_conversations', userId] as const
}

export function messagesQueryKey(conversationId: string | undefined) {
  return ['assistant_messages', conversationId] as const
}

export function useAssistantConversations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: conversationsQueryKey(user?.id),
    queryFn: async (): Promise<AssistantConversation[]> => {
      const { data, error } = await supabase
        .from('assistant_conversations')
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as AssistantConversation[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

export function useAssistantMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: messagesQueryKey(conversationId),
    queryFn: async (): Promise<AssistantMessage[]> => {
      const { data, error } = await supabase
        .from('assistant_messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as AssistantMessage[]
    },
    enabled: Boolean(conversationId),
    staleTime: 5_000,
  })
}

export function useCreateConversation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (title?: string) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('assistant_conversations')
        .insert({ user_id: user.id, title: title ?? 'New conversation' })
        .select()
        .single()
      if (error) throw error
      return data as AssistantConversation
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsQueryKey(user?.id) }),
  })
}

export function useDeleteConversation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assistant_conversations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsQueryKey(user?.id) }),
  })
}

interface SendMessageArgs {
  conversationId: string
  message: string
  history: { role: 'user' | 'assistant'; content: string }[]
  financialContext: string
  /** True for the first message in a conversation — used to derive the conversation's title. */
  isFirstMessage: boolean
}

/**
 * Persists the user's message, calls the loot-assistant Edge Function for a reply, then
 * persists the assistant's reply. The Edge Function holds the GEMINI_API_KEY server-side —
 * it never reaches the client. Requires Ethan to deploy supabase/functions/loot-assistant
 * and set that secret (see LOOT-BUILD-LOG.md).
 */
export function useSendAssistantMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ conversationId, message, history, financialContext, isFirstMessage }: SendMessageArgs) => {
      if (!user) throw new Error('Not signed in')

      const { error: userMsgError } = await supabase
        .from('assistant_messages')
        .insert({ conversation_id: conversationId, user_id: user.id, role: 'user', content: message })
      if (userMsgError) throw userMsgError

      const { data: fnData, error: fnError } = await supabase.functions.invoke<{ reply?: string; error?: string }>(
        'loot-assistant',
        { body: { message, history, financialContext } }
      )
      if (fnError) throw new Error(await describeFunctionError(fnError))
      if (!fnData?.reply) throw new Error(fnData?.error || 'Loot Assistant did not return a reply.')

      const { error: assistantMsgError } = await supabase
        .from('assistant_messages')
        .insert({ conversation_id: conversationId, user_id: user.id, role: 'assistant', content: fnData.reply })
      if (assistantMsgError) throw assistantMsgError

      if (isFirstMessage) {
        await supabase
          .from('assistant_conversations')
          .update({ title: message.slice(0, 60), updated_at: new Date().toISOString() })
          .eq('id', conversationId)
      } else {
        await supabase.from('assistant_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
      }

      return fnData.reply
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(variables.conversationId) })
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey(user?.id) })
    },
  })
}
