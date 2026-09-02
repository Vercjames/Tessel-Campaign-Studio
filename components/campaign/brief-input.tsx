"use client"
import { Button } from "@comps/ui/button"
import { cn } from "@utils/cn"
import { FileJson, FileText, Upload } from "lucide-react"
import { useRef, useState } from "react"

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export function BriefInput({ onFiles, disabled, className, hint }: IBriefInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => /\.(json|ya?ml)$/i.test(f.name))
    if (files.length === 0) return
    const sources = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })))
    onFiles(sources)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target wraps a real button
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) void handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
        dragging && !disabled ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
      aria-disabled={disabled}
    >
      <div className="flex items-center gap-1 text-muted-foreground">
        <FileJson className="size-5" />
        <FileText className="size-5" />
      </div>
      <p className="text-sm font-medium">Drop brief files here</p>
      <p className="text-xs text-muted-foreground">{hint ?? ".json, .yaml or .yml. One campaign per file."}</p>
      <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Upload data-icon="inline-start" />
        Choose files
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.yaml,.yml,application/json,application/x-yaml,text/yaml"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files)
          e.target.value = ""
        }}
      />
    </div>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
export interface IBriefSource {
  name: string
  text: string
}

interface IBriefInputProps {
  onFiles: (sources: IBriefSource[]) => void
  disabled?: boolean
  className?: string
  hint?: string
}
