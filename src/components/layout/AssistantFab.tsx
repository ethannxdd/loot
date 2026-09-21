import { Link, useRouterState } from '@tanstack/react-router'
import { Bot } from 'lucide-react'

export function AssistantFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  if (pathname === '/assistant') return null

  return (
    <Link
      to="/assistant"
      aria-label="Loot Assistant"
      className="fixed right-5 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] z-30 flex h-13 w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6"
      style={{ height: 52, width: 52 }}
    >
      <Bot size={22} strokeWidth={1.75} />
    </Link>
  )
}
