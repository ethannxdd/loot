import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminRpc } from '@/lib/admin'
import type {
  Announcement,
  AnnouncementStats,
  Audience,
  ContentList,
  FeedbackDetail,
  FeedbackList,
  FeedbackPriority,
  FeedbackStatus,
  SavedReply,
} from '@/lib/admin-v2'

/** Admin portal v2 queries and mutations (Migration 032). */

const ADMIN = ['admin', 'data'] as const

export function useAdminFeedback(params: { status: FeedbackStatus | null; kind: string | null; assigned: string | null; search: string; page: number }) {
  return useQuery({
    queryKey: [...ADMIN, 'feedback', params],
    queryFn: () =>
      adminRpc<FeedbackList>('admin_list_feedback', {
        p_status: params.status,
        p_kind: params.kind,
        p_assigned: params.assigned,
        p_search: params.search || null,
        p_limit: 50,
        p_offset: params.page * 50,
      }),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  })
}

/** Unanswered count for the Inbox badge. */
export function useUnansweredFeedback() {
  const { data } = useQuery({
    queryKey: [...ADMIN, 'feedback', 'badge'],
    queryFn: () => adminRpc<FeedbackList>('admin_list_feedback', { p_limit: 1 }),
    staleTime: 60_000,
    retry: false,
    meta: { silent: true },
  })
  return data?.unanswered ?? 0
}

export function useAdminFeedbackThread(id: string) {
  return useQuery({
    queryKey: [...ADMIN, 'feedback-thread', id],
    queryFn: () => adminRpc<FeedbackDetail>('admin_feedback_detail', { p_id: id }),
    staleTime: 10_000,
  })
}

export function useSavedReplies() {
  return useQuery({ queryKey: [...ADMIN, 'saved-replies'], queryFn: () => adminRpc<SavedReply[]>('admin_list_saved_replies'), staleTime: 60_000 })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ADMIN })
}

export function useFeedbackActions() {
  const invalidate = useInvalidate()
  const opts = { onSuccess: invalidate }
  return {
    reply: useMutation({ mutationFn: (a: { id: string; body: string }) => adminRpc('admin_reply_feedback', { p_id: a.id, p_body: a.body }), ...opts }),
    note: useMutation({ mutationFn: (a: { id: string; body: string }) => adminRpc('admin_add_feedback_note', { p_id: a.id, p_body: a.body }), ...opts }),
    update: useMutation({
      mutationFn: (a: { id: string; status?: FeedbackStatus; priority?: FeedbackPriority; assignedTo?: string | null }) =>
        adminRpc('admin_update_feedback', {
          p_id: a.id,
          p_status: a.status ?? null,
          p_priority: a.priority ?? null,
          p_assigned_to: a.assignedTo ?? null,
          p_unassign: a.assignedTo === null,
        }),
      ...opts,
    }),
    saveReply: useMutation({ mutationFn: (a: { id: string | null; title: string; body: string }) => adminRpc('admin_save_reply', { p_id: a.id, p_title: a.title, p_body: a.body }), ...opts }),
    deleteReply: useMutation({ mutationFn: (id: string) => adminRpc('admin_delete_reply', { p_id: id }), ...opts }),
  }
}

export function useAdminContent() {
  return useQuery({ queryKey: [...ADMIN, 'content'], queryFn: () => adminRpc<ContentList>('admin_list_content'), staleTime: 20_000 })
}

export function useContentActions() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  const opts = {
    onSuccess: () => {
      void invalidate()
      void qc.invalidateQueries({ queryKey: ['app_content'] })
    },
  }
  return {
    saveDraft: useMutation({ mutationFn: (a: { key: string; draft: unknown }) => adminRpc('admin_save_setting_draft', { p_key: a.key, p_draft: a.draft }), ...opts }),
    publish: useMutation({ mutationFn: (a: { key: string; reason: string }) => adminRpc('admin_publish_setting', { p_key: a.key, p_reason: a.reason }), ...opts }),
    saveEvent: useMutation({ mutationFn: (e: Record<string, unknown>) => adminRpc<string>('admin_upsert_price_event', { p_event: e }), ...opts }),
    setEventStatus: useMutation({
      mutationFn: (a: { id: string; status: string; reason: string }) => adminRpc('admin_set_price_event_status', { p_id: a.id, p_status: a.status, p_reason: a.reason }),
      ...opts,
    }),
  }
}

export function usePriceEventReach(category: string | null) {
  return useQuery({
    queryKey: [...ADMIN, 'reach', category],
    queryFn: () => adminRpc<number>('admin_price_event_reach', { p_category: category }),
    enabled: Boolean(category),
    staleTime: 60_000,
  })
}

export function useAdminAnnouncements() {
  return useQuery({ queryKey: [...ADMIN, 'announcements'], queryFn: () => adminRpc<Announcement[]>('admin_list_announcements'), staleTime: 20_000 })
}

export function useAnnouncementReach(audience: Audience) {
  return useQuery({
    queryKey: [...ADMIN, 'audience', audience],
    queryFn: () => adminRpc<number>('admin_announcement_reach', { p_audience: audience }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useAnnouncementStats(id: string | null) {
  return useQuery({
    queryKey: [...ADMIN, 'announcement-stats', id],
    queryFn: () => adminRpc<AnnouncementStats>('admin_announcement_stats', { p_id: id }),
    enabled: Boolean(id),
    staleTime: 30_000,
  })
}

export function useAnnouncementActions() {
  const invalidate = useInvalidate()
  const opts = { onSuccess: invalidate }
  return {
    save: useMutation({ mutationFn: (a: Record<string, unknown>) => adminRpc<string>('admin_save_announcement', { p: a }), ...opts }),
    send: useMutation({ mutationFn: (a: { id: string; reason: string }) => adminRpc<{ reach: number }>('admin_send_announcement', { p_id: a.id, p_reason: a.reason }), ...opts }),
    cancel: useMutation({ mutationFn: (a: { id: string; reason: string }) => adminRpc('admin_cancel_announcement', { p_id: a.id, p_reason: a.reason }), ...opts }),
  }
}

export type AnalyticsTab = 'retention' | 'engagement' | 'features' | 'notifications' | 'support'

export function useAdminAnalytics<T>(tab: AnalyticsTab, days: number) {
  return useQuery({
    queryKey: [...ADMIN, 'analytics', tab, days],
    queryFn: () => adminRpc<T>(`admin_analytics_${tab}`, { p_days: days }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useUserPhase6Actions() {
  const invalidate = useInvalidate()
  const opts = { onSuccess: invalidate }
  return {
    clearPush: useMutation({ mutationFn: (a: { user: string; reason: string }) => adminRpc('admin_clear_push', { p_user: a.user, p_reason: a.reason }), ...opts }),
    revokeKey: useMutation({ mutationFn: (a: { user: string; reason: string }) => adminRpc('admin_revoke_capture_key', { p_user: a.user, p_reason: a.reason }), ...opts }),
    resetAssistant: useMutation({ mutationFn: (a: { user: string; reason: string }) => adminRpc('admin_reset_assistant_limit', { p_user: a.user, p_reason: a.reason }), ...opts }),
    testPush: useMutation({ mutationFn: (user: string) => adminRpc('admin_send_test_push', { p_user: user }), ...opts }),
  }
}
