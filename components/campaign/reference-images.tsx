"use client"
import { SelectChips } from "@comps/campaign/select-chips"
import { Button } from "@comps/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@comps/ui/select"
import type { IAssetSummary } from "@utils/api-types"
import type { IReferenceDraft } from "@utils/brief/draft"
import { REFERENCE_ROLES, type TReferenceRole } from "@utils/brief/schema"
import { pickImageFiles, uploadAssets } from "@utils/client/upload-assets"
import { cn } from "@utils/cn"
import { ImagePlus, X } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const ROLE_LABELS: Record<TReferenceRole, string> = {
  product: "The product",
  background: "Background",
  atmosphere: "Atmosphere",
  composition: "Composition",
  palette: "Color palette",
}

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export function ReferenceImages({ value, onChange, library, onLibraryChange, disabled, max = 6, roleOptions }: IReferenceImagesProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const remaining = Math.max(0, max - value.length)
  const available = library.filter((a) => !value.some((r) => r.file === a.name))

  function add(names: string[]) {
    const defaultRole: TReferenceRole = roleOptions ? roleOptions[0] : "product"
    const fresh = names.filter((n) => !value.some((r) => r.file === n)).map((file) => ({ file, roles: [defaultRole] }))
    onChange([...value, ...fresh].slice(0, max))
  }

  async function upload(list: FileList | File[]) {
    const files = pickImageFiles(list).slice(0, remaining)
    if (files.length === 0) return
    setUploading(true)
    try {
      const out = await uploadAssets(files)
      for (const e of out.errors) toast.error(`${e.name}: ${e.message}`)
      add(out.names)
      onLibraryChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function setRoles(file: string, roles: TReferenceRole[]) {
    if (roles.length === 0) return
    const allowed = roleOptions ?? REFERENCE_ROLES
    onChange(value.map((r) => (r.file === file ? { ...r, roles: allowed.filter((x) => roles.includes(x)) } : r)))
  }

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((ref) => {
            const asset = library.find((a) => a.name === ref.file)
            return (
              <li key={ref.file} className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {asset ? (
                    // biome-ignore lint/performance/noImgElement: dynamic local file
                    <img src={asset.url} alt={ref.file} className="size-full object-contain p-1" />
                  ) : (
                    <span className="text-[10px] text-amber-600" title="Not in library">
                      ?
                    </span>
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={ref.file}>
                  {ref.file}
                </span>
                {roleOptions ? (
                  <Select
                    multiple
                    value={ref.roles}
                    onValueChange={(v) => setRoles(ref.file, (Array.isArray(v) ? v : []) as TReferenceRole[])}
                    disabled={disabled}
                  >
                    <SelectTrigger size="sm" className="w-full sm:w-64" aria-label={`Roles for ${ref.file}`}>
                      <SelectValue>
                        {(v: unknown) => {
                          const list = Array.isArray(v) ? (v as TReferenceRole[]) : []
                          return <SelectChips items={list.map((role) => ({ label: ROLE_LABELS[role] }))} placeholder="Choose roles" />
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Product shot</span>
                )}
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((r) => r.file !== ref.file))}
                  aria-label={`Remove ${ref.file}`}
                >
                  <X />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {remaining > 0 ? (
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
            "flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <p className="text-xs text-muted-foreground">Drop reference images here. Without any, the description alone drives the image.</p>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
              <ImagePlus data-icon="inline-start" />
              {uploading ? "Uploading" : "Upload"}
            </Button>
            {available.length > 0 ? (
              <Select
                value={null}
                onValueChange={(v) => {
                  if (typeof v === "string" && v) add([v])
                }}
                disabled={disabled}
              >
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue placeholder="From library" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files)
              e.target.value = ""
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface IReferenceImagesProps {
  roleOptions?: readonly TReferenceRole[]
  value: IReferenceDraft[]
  onChange: (next: IReferenceDraft[]) => void
  library: IAssetSummary[]
  onLibraryChange: () => void
  disabled?: boolean
  max?: number
}
