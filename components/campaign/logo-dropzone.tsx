"use client"
import { Button } from "@comps/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@comps/ui/select"
import type { IAssetSummary } from "@utils/api-types"
import { pickImageFiles, uploadAssets } from "@utils/client/upload-assets"
import { cn } from "@utils/cn"
import { ImagePlus, X } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export function LogoDropzone({ value, onChange, library, onLibraryChange, disabled, className }: ILogoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const asset = value ? library.find((a) => a.name === value) : undefined

  async function upload(list: FileList | File[]) {
    const files = pickImageFiles(list).slice(0, 1)
    if (files.length === 0) return
    setUploading(true)
    try {
      const out = await uploadAssets(files)
      for (const e of out.errors) toast.error(`${e.name}: ${e.message}`)
      if (out.names[0]) onChange(out.names[0])
      onLibraryChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target wraps real buttons
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) void upload(e.dataTransfer.files)
      }}
      aria-disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      {value ? (
        <>
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border bg-card p-2">
            {asset ? (
              // biome-ignore lint/performance/noImgElement: dynamic local file
              <img src={asset.url} alt={value} className="size-full object-contain" />
            ) : (
              <span className="text-xs text-amber-600">not in library</span>
            )}
          </div>
          <p className="max-w-full truncate font-mono text-xs" title={value}>
            {value}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
              <ImagePlus data-icon="inline-start" />
              {uploading ? "Uploading" : "Replace"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(null)}>
              <X data-icon="inline-start" />
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <ImagePlus className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">Drop the shared logo here</p>
          <p className="text-xs text-muted-foreground">Each product chooses where it appears.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
              <ImagePlus data-icon="inline-start" />
              {uploading ? "Uploading" : "Upload"}
            </Button>
            {library.length > 0 ? (
              <Select
                value={null}
                onValueChange={(v) => {
                  if (typeof v === "string" && v) onChange(v)
                }}
                disabled={disabled}
              >
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue placeholder="From library" />
                </SelectTrigger>
                <SelectContent>
                  {library.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        hidden
        onChange={(e) => {
          if (e.target.files) void upload(e.target.files)
          e.target.value = ""
        }}
      />
    </div>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface ILogoDropzoneProps {
  value: string | null
  onChange: (name: string | null) => void
  library: IAssetSummary[]
  onLibraryChange: () => void
  disabled?: boolean
  className?: string
}
