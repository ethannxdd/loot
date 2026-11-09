import { Link } from '@tanstack/react-router'
import { CalendarHeart, Car, ChevronRight, House, LifeBuoy, ShoppingBag, Truck, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useScenarios, type ToolKey } from '@/hooks/useDecide'

interface ToolCard {
  to: string
  tool: ToolKey
  title: string
  line: string
  icon: LucideIcon
  color: string
}

export const TOOL_CARDS: ToolCard[] = [
  { to: '/tools/car', tool: 'car', title: 'True cost of a car', line: 'The instalment is only part of it. Add fuel, insurance and the balloon.', icon: Car, color: 'var(--chart-3)' },
  { to: '/tools/rent-vs-buy', tool: 'rent_vs_buy', title: 'Rent vs buy', line: 'Upfront cash, monthly cost and the year buying pulls ahead.', icon: House, color: 'var(--chart-2)' },
  { to: '/tools/moving-out', tool: 'moving_out', title: 'Moving out', line: 'What your own place costs a month, and the salary it takes.', icon: Truck, color: 'var(--chart-4)' },
  { to: '/tools/runway', tool: 'runway', title: 'Runway / What if', line: 'How long your savings last if your income stops or shrinks.', icon: LifeBuoy, color: 'var(--chart-5)' },
  { to: '/tools/january', tool: 'january', title: 'Survive January', line: 'Make December pay last to January payday, school fees and all.', icon: CalendarHeart, color: 'var(--chart-1)' },
  { to: '/tools/black-friday', tool: 'black_friday', title: 'Black Friday', line: 'Set a budget from Safe to spend and check your list against it.', icon: ShoppingBag, color: 'var(--chart-6)' },
]

/** /tools (§4.5): the calculators and seasonal planners. */
export function ToolsPage() {
  const { data: scenarios = [] } = useScenarios()
  return (
    <div className="animate-enter space-y-6">
      <PageHeader eyebrow="Planning" title="Tools" subtitle="Run the numbers on the big decisions before you sign anything." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tutorial="tools-grid">
        {TOOL_CARDS.map((t) => {
          const last = scenarios.find((s) => s.tool === t.tool)
          const Icon = t.icon
          return (
            <Link key={t.to} to={t.to} className="card card-hover flex flex-col gap-3">
              <span className="icon-tile" style={{ background: t.color }}>
                <Icon size={17} strokeWidth={2} />
              </span>
              <div className="flex-1">
                <p className="text-[16px] font-semibold">{t.title}</p>
                <p className="mt-0.5 text-[13.5px] text-muted-foreground">{t.line}</p>
              </div>
              <p className="flex items-center justify-between text-[12.5px] text-muted-foreground">
                {last ? `Last saved: ${last.name}` : 'Open'}
                <ChevronRight size={15} className="text-text-subtle" />
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
