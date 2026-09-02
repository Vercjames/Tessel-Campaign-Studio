import { cn } from "@utils/cn"

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export function SelectChips({ items, placeholder, max = 2, mono }: ISelectChipsProps) {
  if (items.length === 0) return <span className="text-muted-foreground">{placeholder}</span>
  const shown = items.slice(0, max)
  const rest = items.length - shown.length
  return (
    <span className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
      {shown.map((item) => (
        <span key={item.label} className={cn("shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs", mono && "font-mono")}>
          {item.label}
        </span>
      ))}
      {rest > 0 ? <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">+{rest}</span> : null}
    </span>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface ISelectChipsProps {
  items: { label: string }[]
  placeholder: string
  max?: number
  mono?: boolean
}
