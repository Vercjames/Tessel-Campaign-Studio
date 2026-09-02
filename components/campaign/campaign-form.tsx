"use client"
import { ProductEditor } from "@comps/campaign/product-editor"
import { SelectChips } from "@comps/campaign/select-chips"
import { Button } from "@comps/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@comps/ui/dropdown-menu"
import { Input } from "@comps/ui/input"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@comps/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@comps/ui/select"
import { Separator } from "@comps/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@comps/ui/tooltip"
import type { IAssetSummary } from "@utils/api-types"
// biome-ignore format: imports stay on one line
import { emptyProduct, type IBrandColorsDraft, type ICampaignDraft, type IProductDraft, type TDraftValidation, validateDraft } from "@utils/brief/draft"
import { languageName } from "@utils/brief/prompt"
// biome-ignore format: imports stay on one line
import { ASPECT_RATIOS, LOCALE_OPTIONS, LOGO_PLACEMENTS, LOGO_POSITIONS, type TAspectRatio, type TLogoPlacement, type TLogoPosition } from "@utils/brief/schema"
import { exportDraft } from "@utils/client/export-brief"
import { cn } from "@utils/cn"
import { ChevronDown, Download, ImageOff, Info, Play, Plus, Square, Trash2 } from "lucide-react"
import { useId, useMemo } from "react"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
export const SHARED_LOGO_SECTION_ID = "shared-logo"

const RATIO_LABELS: Record<TAspectRatio, string> = {
  "1:1": "square",
  "2:3": "portrait",
  "3:2": "landscape",
  "3:4": "portrait",
  "4:3": "landscape",
  "9:16": "story",
  "16:9": "wide",
  "21:9": "banner",
}

const LOGO_LABELS: Record<TLogoPlacement, string> = {
  corner: "Corner overlay",
  product: "On the products",
}

const COLOR_ROLES: Array<{ key: keyof IBrandColorsDraft; label: string; help: string }> = [
  { key: "primary", label: "Primary", help: "The dominant brand color. Used for key surfaces, the message and logo accents." },
  { key: "secondary", label: "Secondary", help: "The supporting color. Backgrounds and secondary surfaces that sit against primary." },
  { key: "tone", label: "Tone", help: "A tonal accent. Highlights, small details and the overall color cast of light and mood." },
]

const POSITION_LABELS: Record<TLogoPosition, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
}

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function indexIssues(validation: TDraftValidation) {
  const campaign: Record<string, string> = {}
  const products: Record<number, Record<string, string>> = {}
  if (validation.ok) return { campaign, products, count: 0 }
  for (const issue of validation.issues) {
    const m = /^products\[(\d+)\]\.?(.*)$/.exec(issue.path)
    if (m) {
      const idx = Number(m[1])
      const field = m[2].split(".")[0].split("[")[0] || "_"
      products[idx] = { ...products[idx], [field]: products[idx]?.[field] ?? issue.message }
    } else {
      const field = issue.path.split(".")[0].split("[")[0] || "_"
      campaign[field] = campaign[field] ?? issue.message
    }
  }
  return { campaign, products, count: validation.issues.length }
}

function Field({ label, htmlFor, error, hint, className, children }: IFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

function ColorField({ id, label, help, value, onChange }: IColorFieldProps) {
  const valid = isHex(value)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <Tooltip>
          <TooltipTrigger
            render={
              <button type="button" className="rounded-sm text-muted-foreground hover:text-foreground" aria-label={`About ${label}`} />
            }
          >
            <Info className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{help}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} swatch`}
          value={valid ? value.trim() : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-card p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#0E7C86"
          className="font-mono"
          aria-invalid={value.trim().length > 0 && !valid}
        />
      </div>
    </div>
  )
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{children}</h3>
      {aside}
    </div>
  )
}

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export function CampaignForm({
  draft,
  onChange,
  onRemove,
  onGenerate,
  onStop,
  running,
  library,
  onLibraryChange,
  disabled,
  canGenerate,
}: ICampaignFormProps) {
  const uid = useId()
  const validation = useMemo(() => validateDraft(draft), [draft])
  const issues = useMemo(() => indexIssues(validation), [validation])

  const set = <K extends keyof ICampaignDraft>(key: K, value: ICampaignDraft[K]) => onChange({ ...draft, [key]: value })
  const setProduct = (index: number, next: IProductDraft) =>
    set(
      "products",
      draft.products.map((p, i) => (i === index ? next : p)),
    )

  const hasLogo = Boolean(draft.logo)
  const logoPlaces = [
    draft.logoPlacement.includes("corner") ? `in the ${POSITION_LABELS[draft.logoPosition].toLowerCase()} corner` : null,
    draft.logoPlacement.includes("product") ? "on the products" : null,
  ].filter(Boolean)
  const logoMissingPlacement = hasLogo && logoPlaces.length === 0
  const logoStatus = !hasLogo
    ? undefined
    : logoMissingPlacement
      ? "No logo will appear: pick at least one placement."
      : `${draft.logo} appears ${logoPlaces.join(" and ")}.`
  const localeCount = Math.max(1, draft.locales.length)
  const imageCount = draft.aspectRatios.length * localeCount
  const subjectCount = draft.products.filter((p) => p.kind === "product").length
  const compositionCount = draft.products.length - subjectCount

  // NOTE: At least one ratio must stay selected, so the last active chip cannot be toggled off
  function toggleRatio(ratio: TAspectRatio) {
    const has = draft.aspectRatios.includes(ratio)
    if (has && draft.aspectRatios.length === 1) return
    const next = has
      ? draft.aspectRatios.filter((r) => r !== ratio)
      : ASPECT_RATIOS.filter((r) => r === ratio || draft.aspectRatios.includes(r))
    set("aspectRatios", next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            id={`${uid}-name`}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={disabled}
            placeholder="Untitled campaign"
            aria-label="Campaign name"
            aria-invalid={Boolean(issues.campaign.name)}
            className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm font-semibold tracking-tight outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              issues.count > 0
                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            {issues.count > 0 ? `${issues.count} to fix` : "ready"}
          </span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Clear campaign"
            title="Clear campaign"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {issues.campaign.name ? <p className="text-xs text-destructive">{issues.campaign.name}</p> : null}

      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
          <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
            <span>
              {subjectCount} product{subjectCount === 1 ? "" : "s"}
            </span>
            {compositionCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {compositionCount} composition reference{compositionCount === 1 ? "" : "s"}
                </span>
              </>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}>
                <Download data-icon="inline-start" />
                Export
                <ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportDraft(draft, "yaml")}>YAML</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportDraft(draft, "json")}>JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {running ? (
              <Button type="button" size="sm" variant="destructive" onClick={onStop}>
                <Square data-icon="inline-start" />
                Stop
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={disabled || !validation.ok || !canGenerate} onClick={onGenerate}>
                <Play data-icon="inline-start" />
                Generate {imageCount}
              </Button>
            )}
          </div>
        </header>

        <div className="space-y-8 px-6 py-6">
          <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
            <SectionTitle>Campaign</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Message" htmlFor={`${uid}-message`} className="sm:col-span-2">
                <div className="relative">
                  <Input
                    id={`${uid}-message`}
                    value={draft.message}
                    onChange={(e) => set("message", e.target.value)}
                    placeholder="Find out how to get started."
                    className="pr-9"
                  />
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                          aria-label="About the campaign message"
                        />
                      }
                    >
                      <Info />
                    </PopoverTrigger>
                    <PopoverContent className="max-w-xs">
                      <PopoverHeader>
                        <PopoverTitle>Campaign message</PopoverTitle>
                        <PopoverDescription>
                          This is the text rendered onto the generated image(s) as the headline. Leave it empty for images with no text.
                        </PopoverDescription>
                      </PopoverHeader>
                    </PopoverContent>
                  </Popover>
                </div>
              </Field>
              <Field label="Audience" htmlFor={`${uid}-audience`} error={issues.campaign.audience} className="sm:col-span-2">
                <Input
                  id={`${uid}-audience`}
                  value={draft.audience}
                  onChange={(e) => set("audience", e.target.value)}
                  placeholder="Active adults 25–40 seeking a summer fitness program"
                  aria-invalid={Boolean(issues.campaign.audience)}
                />
              </Field>
              <Field label="Exclusions" htmlFor={`${uid}-avoid`} className="sm:col-span-2">
                <Input
                  id={`${uid}-avoid`}
                  value={draft.avoid}
                  onChange={(e) => set("avoid", e.target.value)}
                  placeholder="no faces, no extra text"
                />
              </Field>
              <Field label="Region / market" htmlFor={`${uid}-region`} error={issues.campaign.region}>
                <Input
                  id={`${uid}-region`}
                  value={draft.region}
                  onChange={(e) => set("region", e.target.value)}
                  placeholder="Southwest US"
                  aria-invalid={Boolean(issues.campaign.region)}
                />
              </Field>
              <Field label="Locales" htmlFor={`${uid}-locales`} error={issues.campaign.locales}>
                <Select
                  multiple
                  value={draft.locales}
                  onValueChange={(v) => {
                    // NOTE: Keep at least one locale selected so the brief never validates empty
                    const next = Array.isArray(v) ? (v as string[]) : []
                    if (next.length > 0)
                      set(
                        "locales",
                        LOCALE_OPTIONS.filter((l) => next.includes(l)),
                      )
                  }}
                >
                  <SelectTrigger id={`${uid}-locales`} className="w-full" aria-invalid={Boolean(issues.campaign.locales)}>
                    <SelectValue>
                      {(value: unknown) => {
                        const list = Array.isArray(value) ? (value as string[]) : []
                        return <SelectChips items={list.map((l) => ({ label: l }))} placeholder="Choose locales" max={4} mono />
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALE_OPTIONS.map((l) => (
                      <SelectItem key={l} value={l}>
                        <span className="font-mono text-xs">{l}</span>
                        <span className="ml-2 text-muted-foreground">{languageName(l)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </fieldset>

          <Separator />

          <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
            <SectionTitle aside={<span className="text-xs text-muted-foreground">Optional</span>}>Brand colors</SectionTitle>
            <p className="text-xs text-muted-foreground">
              Leave these empty and the images take their palette from the references and art direction.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {COLOR_ROLES.map((role) => (
                <ColorField
                  key={role.key}
                  id={`${uid}-color-${role.key}`}
                  label={role.label}
                  help={role.help}
                  value={draft.colors[role.key]}
                  onChange={(v) => set("colors", { ...draft.colors, [role.key]: v })}
                />
              ))}
            </div>
            {issues.campaign.brand ? <p className="text-xs text-destructive">{issues.campaign.brand}</p> : null}
          </fieldset>

          <Separator />

          <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
            <SectionTitle>Output</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Aspect ratios</p>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECT_RATIOS.map((r) => {
                    const active = draft.aspectRatios.includes(r)
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleRatio(r)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs transition-colors duration-150 ease-out-quart focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                        )}
                      >
                        <span className="font-mono">{r}</span>
                        <span className="ml-1 opacity-80">{RATIO_LABELS[r]}</span>
                      </button>
                    )
                  })}
                </div>
                {issues.campaign.aspectRatio ? <p className="text-xs text-destructive">{issues.campaign.aspectRatio}</p> : null}
              </div>

              <Field label="Logo" htmlFor={`${uid}-logo`} hint={logoStatus} error={logoMissingPlacement ? logoStatus : undefined}>
                {!hasLogo ? (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
                    <ImageOff className="size-4 shrink-0 text-muted-foreground" />
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                      No shared logo yet. Add one in the Shared logo section to place it on the image.
                    </p>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        document.getElementById(SHARED_LOGO_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }
                    >
                      Add logo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Select
                      multiple
                      value={draft.logoPlacement}
                      onValueChange={(v) =>
                        set(
                          "logoPlacement",
                          LOGO_PLACEMENTS.filter((m) => (Array.isArray(v) ? (v as string[]) : []).includes(m)),
                        )
                      }
                      disabled={!hasLogo}
                    >
                      <SelectTrigger id={`${uid}-logo`} className="w-full">
                        <SelectValue>
                          {(v: unknown) => {
                            const list = Array.isArray(v) ? (v as TLogoPlacement[]) : []
                            return <SelectChips items={list.map((m) => ({ label: LOGO_LABELS[m] }))} placeholder="No logo" />
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {LOGO_PLACEMENTS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {LOGO_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasLogo && draft.logoPlacement.includes("corner") ? (
                      <Select value={draft.logoPosition} onValueChange={(v) => v && set("logoPosition", v as TLogoPosition)}>
                        <SelectTrigger className="w-full" aria-label="Logo position">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOGO_POSITIONS.map((pos) => (
                            <SelectItem key={pos} value={pos}>
                              {POSITION_LABELS[pos]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                )}
              </Field>
            </div>
          </fieldset>

          <Separator />

          <div className="space-y-2">
            <SectionTitle
              aside={issues.campaign.products ? <span className="text-xs text-destructive">{issues.campaign.products}</span> : null}
            >
              Scene
            </SectionTitle>
            <p className="text-xs text-muted-foreground">Products to feature, and the setting, atmosphere or layout that frames them.</p>
            <div className="space-y-4">
              {draft.products.map((product, i) => (
                <ProductEditor
                  key={product.key}
                  index={i}
                  product={product}
                  onChange={(next) => setProduct(i, next)}
                  onRemove={() =>
                    set(
                      "products",
                      draft.products.filter((_, j) => j !== i),
                    )
                  }
                  canRemove={draft.products.length > 1}
                  library={library}
                  onLibraryChange={onLibraryChange}
                  disabled={disabled}
                  issues={issues.products[i] ?? {}}
                />
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="border-dashed"
                disabled={disabled || draft.products.length >= 12}
                onClick={() => set("products", [...draft.products, emptyProduct("product")])}
              >
                <Plus data-icon="inline-start" />
                Add product
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-dashed"
                disabled={disabled || draft.products.length >= 12}
                onClick={() => set("products", [...draft.products, emptyProduct("composition")])}
              >
                <Plus data-icon="inline-start" />
                Add composition reference
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface ICampaignFormProps {
  draft: ICampaignDraft
  onChange: (next: ICampaignDraft) => void
  onRemove: () => void
  onGenerate: () => void
  onStop: () => void
  running: boolean
  library: IAssetSummary[]
  onLibraryChange: () => void
  disabled?: boolean
  canGenerate: boolean
}

interface IColorFieldProps {
  id: string
  label: string
  help: string
  value: string
  onChange: (value: string) => void
}

interface IFieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}
