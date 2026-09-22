import { useNavigate } from '@tanstack/react-router'
import { Database, Download, Loader2, LogOut, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useDeleteAccount, useExportData, useResetAllData } from '@/hooks/useAccountData'

export function DataSection() {
  const { signOut } = useAuth()
  const exportData = useExportData()
  const resetData = useResetAllData()
  const deleteAccount = useDeleteAccount()
  const navigate = useNavigate()
  const [resetOpen, setResetOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePhrase, setDeletePhrase] = useState('')

  function closeReset() {
    setResetOpen(false)
    setPhrase('')
  }

  function closeDelete() {
    if (deleteAccount.isPending) return
    setDeleteOpen(false)
    setDeletePhrase('')
  }

  async function handleDeleteAccount() {
    // mutateAsync (not mutate's per-call callbacks): signing out unmounts this screen, and callbacks passed to
    // mutate() are dropped when that happens. Failures are toasted by the global mutation error handler.
    try {
      await deleteAccount.mutateAsync()
    } catch {
      return
    }
    void navigate({ to: '/' })
    toast.success('Your account has been deleted')
  }

  return (
    <>
      <section className="card space-y-4">
        <div className="overline-label flex items-center gap-1.5">
          <Database size={13} strokeWidth={2} /> Your data
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Export everything</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Download all your Loot data as a JSON file.</p>
          </div>
          <button
            type="button"
            onClick={() => exportData.mutate(undefined, { onSuccess: () => toast.success('Export downloaded') })}
            disabled={exportData.isPending}
            className="btn btn-ghost shrink-0"
          >
            {exportData.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} strokeWidth={1.75} />}
            Export
          </button>
        </div>
      </section>

      <section className="card space-y-3 border border-alert/25">
        <div className="overline-label flex items-center gap-1.5 !text-alert">
          <TriangleAlert size={13} strokeWidth={2} /> Danger zone
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Reset all data</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Deletes your expenses, goals, plans, snapshots, tax data and scores, and zeroes your income. Your account stays.
            </p>
          </div>
          <button type="button" onClick={() => setResetOpen(true)} className="btn btn-destructive shrink-0">
            Reset
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-hairline pt-3">
          <div>
            <p className="text-sm font-semibold">Delete account</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Permanently deletes your account and everything in it. This can’t be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete account"
            className="btn btn-destructive shrink-0"
          >
            Delete
          </button>
        </div>
      </section>

      <button type="button" onClick={() => void signOut()} className="btn btn-ghost w-full sm:w-auto">
        <LogOut size={16} strokeWidth={1.75} />
        Sign out
      </button>

      {resetOpen && (
        <Modal title="Reset all data?" onClose={closeReset}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This permanently deletes everything you’ve entered in Loot. It can’t be undone — consider exporting first.
            </p>
            <div>
              <label className="field-label" htmlFor="reset-phrase">
                Type <span className="font-bold text-foreground">RESET</span> to confirm
              </label>
              <input id="reset-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={closeReset} className="btn btn-ghost flex-1">
                Cancel
              </button>
              <button
                type="button"
                disabled={phrase.trim() !== 'RESET' || resetData.isPending}
                onClick={() =>
                  resetData.mutate(undefined, {
                    onSuccess: () => {
                      closeReset()
                      toast.success('Everything has been reset')
                    },
                  })
                }
                className="btn btn-destructive flex-1"
              >
                {resetData.isPending && <Loader2 size={16} className="animate-spin" />}
                Delete everything
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteOpen && (
        <Modal title="Delete your account?" onClose={closeDelete}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This permanently deletes your Loot account and all of your data — expenses, goals, plans, tax details,
              scores and history. You’ll be signed out straight away and won’t be able to get it back. Consider
              exporting your data first.
            </p>
            <p className="text-xs text-text-muted">
              If you own a household, it’s removed too — your partner keeps their own account and data but is unlinked.
            </p>
            <div>
              <label className="field-label" htmlFor="delete-phrase">
                Type <span className="font-bold text-foreground">DELETE</span> to confirm
              </label>
              <input
                id="delete-phrase"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={closeDelete} disabled={deleteAccount.isPending} className="btn btn-ghost flex-1">
                Cancel
              </button>
              <button
                type="button"
                disabled={deletePhrase.trim() !== 'DELETE' || deleteAccount.isPending}
                onClick={() => void handleDeleteAccount()}
                className="btn btn-destructive flex-1"
              >
                {deleteAccount.isPending && <Loader2 size={16} className="animate-spin" />}
                Delete my account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
