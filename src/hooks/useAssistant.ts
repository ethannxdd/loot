import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { describeFunctionError } from '@/lib/function-error'
import { supabase } from '@/lib/supabase'
import { runTool, type ToolData } from '@/lib/assistant-tools'
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
  /** The person's data for running tool calls in the browser (Rule 25). */
  toolData: ToolData | null
  /** True for the first message in a conversation — used to derive the conversation's title. */
  isFirstMessage: boolean
}

interface AssistantResponse {
  reply?: string
  limit?: boolean
  error?: string
  left?: number
  functionCalls?: { name: string; args: Record<string, unknown> }[]
  modelContent?: { role: 'model'; parts: unknown[] }
}

/** Tool round-trips allowed per question before giving up. */
const MAX_TOOL_ROUNDS = 4

/**
 * Ask Loot (Phase 6 B6). Persists the question, then talks to the loot-assistant edge function: when Gemini asks for
 * a tool, it runs here with src/lib (lib/assistant-tools.ts) and the results go back ("continue") until there's an
 * answer. The model never sees raw transactions or other people's names, and never computes money itself.
 */
export function useSendAssistantMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ conversationId, message, history, financialContext, toolData, isFirstMessage }: SendMessageArgs) => {
      if (!user) throw new Error('Not signed in')

      const { error: userMsgError } = await supabase
        .from('assistant_messages')
        .insert({ conversation_id: conversationId, user_id: user.id, role: 'user', content: message })
      if (userMsgError) throw userMsgError

      const contents: { role: 'user' | 'model'; parts: unknown[] }[] = [
        ...history.slice(-12).map((t) => ({ role: (t.role === 'assistant' ? 'model' : 'user') as 'user' | 'model', parts: [{ text: t.content }] })),
        { role: 'user', parts: [{ text: message }] },
      ]
      let reply = ''
      let limited = false
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const { data, error } = await supabase.functions.invoke<AssistantResponse>('loot-assistant', {
          body: { kind: round === 0 ? 'question' : 'continue', contents, financialContext },
        })
        if (error) throw new Error(await describeFunctionError(error))
        if (!data) throw new Error('Ask Loot did not answer.')
        if (data.limit) {
          reply = data.reply ?? 'That’s it for today.'
          limited = true
          break
        }
        if (data.error) throw new Error(data.error)
        if (data.functionCalls && data.modelContent) {
          if (!toolData) throw new Error('Your numbers are still loading. Try again in a moment.')
          contents.push(data.modelContent)
          contents.push({
            role: 'user',
            parts: data.functionCalls.map((c) => ({ functionResponse: { name: c.name, response: runTool(c.name, c.args ?? {}, toolData) } })),
          })
          continue
        }
        reply = data.reply ?? ''
        break
      }
      if (!reply) throw new Error('Ask Loot couldn’t finish that one. Try asking it another way.')

      const { error: assistantMsgError } = await supabase
        .from('assistant_messages')
        .insert({ conversation_id: conversationId, user_id: user.id, role: 'assistant', content: reply })
      if (assistantMsgError) throw assistantMsgError

      await supabase
        .from('assistant_conversations')
        .update(isFirstMessage ? { title: message.slice(0, 60), updated_at: new Date().toISOString() } : { updated_at: new Date().toISOString() })
        .eq('id', conversationId)

      return { reply, limited }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(variables.conversationId) })
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['assistant_usage', user?.id] })
    },
  })
}
