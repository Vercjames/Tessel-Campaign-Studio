"use client"
import { Button } from "@comps/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@comps/ui/dropdown-menu"
import { ChevronDown, Download } from "lucide-react"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
const EXAMPLES = [
  { label: "YAML", href: "/examples/campaign-brief.yaml" },
  { label: "JSON", href: "/examples/campaign-brief.json" },
]

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export function ExampleDownloads() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download data-icon="inline-start" />
        Download example
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {EXAMPLES.map((e) => (
          // biome-ignore lint/a11y/useAnchorContent: the item children render inside the anchor via the render prop
          <DropdownMenuItem key={e.href} render={<a href={e.href} download />}>
            <span className="font-medium">{e.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
