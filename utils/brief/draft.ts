import { finalizeBrief, formatIssuePath, type IParseIssue } from "@utils/brief/parse"
// biome-ignore format: imports stay on one line
import { CampaignBriefSchema, type TAspectRatio, type TCampaignBrief, type TLogoPlacement, type TLogoPosition, type TProductKind, type TReferenceRole } from "@utils/brief/schema"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
let counter = 0

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function opt(text: string): string | undefined {
  const t = text.trim()
  return t.length > 0 ? t : undefined
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
function nextKey(prefix = "k"): string {
  counter += 1
  return `${prefix}${counter}-${Date.now().toString(36)}`
}

export function emptyProduct(kind: TProductKind = "product"): IProductDraft {
  return {
    key: nextKey("p"),
    id: "",
    name: "",
    description: "",
    kind,
    referenceImages: [],
  }
}

export function emptyDraft(): ICampaignDraft {
  return {
    key: nextKey("c"),
    source: "new",
    id: "",
    name: "",
    region: "",
    audience: "",
    message: "",
    locales: ["en"],
    aspectRatios: ["1:1"],
    logo: null,
    logoPlacement: ["corner"],
    logoPosition: "top-right",
    colors: { primary: "", secondary: "", tone: "" },
    avoid: "",
    products: [emptyProduct()],
  }
}

export function briefToDraft(brief: TCampaignBrief, source: string): ICampaignDraft {
  return {
    key: nextKey("c"),
    source,
    id: brief.id ?? "",
    name: brief.name ?? "",
    region: brief.region ?? "",
    audience: brief.audience ?? "",
    message: brief.message ?? "",
    locales: [...brief.locales],
    aspectRatios: [...brief.aspectRatio],
    logo: brief.brand?.logo ?? null,
    logoPlacement: [...brief.logoPlacement],
    logoPosition: brief.logoPosition,
    colors: {
      primary: brief.brand?.colors?.primary ?? "",
      secondary: brief.brand?.colors?.secondary ?? "",
      tone: brief.brand?.colors?.tone ?? "",
    },
    avoid: brief.avoid ?? "",
    products: brief.products.map((p) => ({
      key: nextKey("p"),
      id: p.id ?? "",
      name: p.name,
      description: p.description,
      kind: p.kind,
      referenceImages: (p.referenceImages ?? []).map((r) => ({ file: r.file, roles: [...r.roles] })),
    })),
  }
}

export function draftToInput(draft: ICampaignDraft): unknown {
  const colors = {
    primary: opt(draft.colors.primary),
    secondary: opt(draft.colors.secondary),
    tone: opt(draft.colors.tone),
  }
  const hasColors = Object.values(colors).some((v) => v !== undefined)
  const brand = {
    logo: draft.logo ?? undefined,
    colors: hasColors ? colors : undefined,
  }
  const hasBrand = Object.values(brand).some((v) => v !== undefined)
  return {
    id: opt(draft.id),
    name: opt(draft.name),
    region: opt(draft.region),
    audience: opt(draft.audience),
    message: opt(draft.message),
    locales: draft.locales.length > 0 ? draft.locales : undefined,
    aspectRatio: draft.aspectRatios,
    brand: hasBrand ? brand : undefined,
    logoPlacement: draft.logoPlacement,
    logoPosition: draft.logoPosition,
    avoid: opt(draft.avoid),
    products: draft.products.map((p) => ({
      id: opt(p.id),
      name: p.name.trim(),
      description: p.description.trim(),
      kind: p.kind === "product" ? undefined : p.kind,
      referenceImages:
        p.referenceImages.length > 0
          ? p.referenceImages.map((r) => {
              const bare = p.kind === "product" || (r.roles.length === 1 && r.roles[0] === "background")
              return bare ? r.file : { file: r.file, roles: r.roles }
            })
          : undefined,
    })),
  }
}

export function validateDraft(draft: ICampaignDraft): TDraftValidation {
  const result = CampaignBriefSchema.safeParse(draftToInput(draft))
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((i) => ({
        path: formatIssuePath(i.path),
        message: i.message,
      })),
    }
  }
  return { ok: true, brief: finalizeBrief(result.data) }
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
export interface IProductDraft {
  key: string
  id: string
  name: string
  description: string
  kind: TProductKind
  referenceImages: IReferenceDraft[]
}

export interface IBrandColorsDraft {
  primary: string
  secondary: string
  tone: string
}

export interface IReferenceDraft {
  file: string
  roles: TReferenceRole[]
}

export interface ICampaignDraft {
  key: string
  source: string
  id: string
  name: string
  region: string
  audience: string
  message: string
  locales: string[]
  aspectRatios: TAspectRatio[]
  logo: string | null
  logoPlacement: TLogoPlacement[]
  logoPosition: TLogoPosition
  colors: IBrandColorsDraft
  avoid: string
  products: IProductDraft[]
}

export type TDraftValidation = { ok: true; brief: TCampaignBrief } | { ok: false; issues: IParseIssue[] }
