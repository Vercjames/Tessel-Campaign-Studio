"use client"
import { ReferenceImages } from "@comps/campaign/reference-images"
import { Button } from "@comps/ui/button"
import { Input } from "@comps/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@comps/ui/select"
import { Textarea } from "@comps/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@comps/ui/tooltip"
import type { IAssetSummary } from "@utils/api-types"
import type { IProductDraft } from "@utils/brief/draft"
import { COMPOSITION_ROLES, PRODUCT_KINDS, type TProductKind, type TReferenceRole } from "@utils/brief/schema"
import { Info, Trash2 } from "lucide-react"
import { useId } from "react"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const KIND_LABELS: Record<TProductKind, string> = {
  product: "product",
  composition: "composition",
}

const KIND_HINTS: Record<TProductKind, string> = {
  product: "A subject that must be visible in the final image. Its reference images are product shots.",
  composition: "Shapes the scene around the products: background, atmosphere, layout or palette. Not a subject itself.",
}

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export function ProductEditor({
  index,
  product,
  onChange,
  onRemove,
  canRemove,
  library,
  onLibraryChange,
  disabled,
  issues,
}: IProductEditorProps) {
  const uid = useId()
  const set = <K extends keyof IProductDraft>(key: K, value: IProductDraft[K]) => onChange({ ...product, [key]: value })

  // NOTE: Switching kind re-labels existing references so none is left with a role the kind cannot carry
  function setKind(kind: TProductKind) {
    const fallback: TReferenceRole = kind === "product" ? "product" : "background"
    const referenceImages = product.referenceImages.map((r) => {
      const roles = kind === "product" ? ["product" as TReferenceRole] : r.roles.filter((x) => x !== "product")
      return { ...r, roles: roles.length > 0 ? roles : [fallback] }
    })
    onChange({ ...product, kind, referenceImages })
  }

  return (
    <fieldset disabled={disabled} className="overflow-hidden rounded-lg border bg-background disabled:opacity-60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <Input
              id={`${uid}-name`}
              value={product.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={product.kind === "composition" ? "Scene element" : "Product name"}
              aria-label="Item name"
              aria-invalid={Boolean(issues.name)}
              className="h-8 max-w-sm border-transparent bg-transparent px-2 text-sm font-medium shadow-none hover:border-input"
            />
            {issues.name ? <p className="px-2 pt-1 text-xs text-destructive">{issues.name}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={product.kind} onValueChange={(v) => v && setKind(v as TProductKind)}>
            <SelectTrigger size="sm" className="w-40" aria-label="Item kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={!canRemove}
            onClick={onRemove}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${uid}-desc`} className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="rounded-sm text-muted-foreground hover:text-foreground"
                    aria-label="About the description"
                  />
                }
              >
                <Info className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Describe how this item should look in the final image. It works on its own in place of a product image, or alongside
                reference images to add detail they do not show.
              </TooltipContent>
            </Tooltip>
          </div>
          <Textarea
            id={`${uid}-desc`}
            value={product.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={
              product.kind === "composition"
                ? "Bright modern gym at golden hour, polished floors, soft haze"
                : "Matte black insulated bottle with a bamboo cap, condensation on the surface"
            }
            className="min-h-20"
            aria-invalid={Boolean(issues.description)}
          />
          {issues.description ? (
            <p className="text-xs text-destructive">{issues.description}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{KIND_HINTS[product.kind]}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Reference images</p>
          <ReferenceImages
            value={product.referenceImages}
            onChange={(refs) => set("referenceImages", refs)}
            library={library}
            onLibraryChange={onLibraryChange}
            disabled={disabled}
            roleOptions={product.kind === "composition" ? COMPOSITION_ROLES : undefined}
          />
          {issues.referenceImages ? <p className="text-xs text-destructive">{issues.referenceImages}</p> : null}
        </div>
      </div>
    </fieldset>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface IProductEditorProps {
  index: number
  product: IProductDraft
  onChange: (next: IProductDraft) => void
  onRemove: () => void
  canRemove: boolean
  library: IAssetSummary[]
  onLibraryChange: () => void
  disabled?: boolean
  issues: Record<string, string>
}
