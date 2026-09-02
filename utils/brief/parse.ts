import { CampaignBriefSchema, normalizeBriefInput, type TCampaignBrief } from "@utils/brief/schema"
import { loadAll } from "js-yaml"

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function loadDocuments(text: string, format: TBriefFormat): unknown[] {
  if (format === "json") return [JSON.parse(text)]
  // NOTE: loadAll supports multi-document YAML separated by `---`
  return loadAll(text).filter((doc) => doc !== null && doc !== undefined)
}

function flattenDocument(doc: unknown): unknown[] {
  if (Array.isArray(doc)) return doc
  if (doc && typeof doc === "object" && "campaigns" in doc) {
    const campaigns = (doc as { campaigns: unknown }).campaigns
    return Array.isArray(campaigns) ? campaigns : [campaigns]
  }
  return [doc]
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
function detectFormat(filename: string, text: string): TBriefFormat | null {
  const ext = filename.toLowerCase().split(".").pop() ?? ""
  if (ext === "json") return "json"
  if (ext === "yaml" || ext === "yml") return "yaml"
  const trimmed = text.trimStart()
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json"
  if (trimmed.length > 0) return "yaml"
  return null
}

export function formatIssuePath(path: PropertyKey[]): string {
  return path
    .map((seg, i) => {
      if (typeof seg === "number") return `[${seg}]`
      return i === 0 ? String(seg) : `.${String(seg)}`
    })
    .join("")
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug || "item"
}

export function finalizeBrief(brief: TCampaignBrief): TCampaignBrief {
  const seen = new Set<string>()
  const products = brief.products.map((p) => {
    const base = p.id ?? slugify(p.name)
    let id = base
    let n = 2
    while (seen.has(id)) id = `${base}-${n++}`
    seen.add(id)
    return { ...p, id }
  })
  return { ...brief, id: brief.id ?? slugify(brief.name ?? "campaign"), products }
}

export function parseBriefs(text: string, filename = "brief"): TParseResult {
  const format = detectFormat(filename, text)
  if (!format) {
    return {
      ok: false,
      format: null,
      issues: [{ path: "", message: "File is empty" }],
    }
  }

  let documents: unknown[]
  try {
    documents = loadDocuments(text, format)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      format,
      issues: [
        {
          path: "",
          message: `${format.toUpperCase()} syntax error: ${message}`,
        },
      ],
    }
  }

  const candidates = documents.flatMap(flattenDocument).map(normalizeBriefInput)
  if (candidates.length === 0) {
    return {
      ok: false,
      format,
      issues: [{ path: "", message: "No campaign found in file" }],
    }
  }

  const briefs: TCampaignBrief[] = []
  const issues: IParseIssue[] = []
  const seenIds = new Set<string>()

  candidates.forEach((candidate, index) => {
    const result = CampaignBriefSchema.safeParse(candidate)
    const prefix = candidates.length > 1 ? `campaigns[${index}]` : ""
    if (!result.success) {
      for (const issue of result.error.issues) {
        const inner = formatIssuePath(issue.path)
        issues.push({
          path: [prefix, inner].filter(Boolean).join("."),
          message: issue.message,
        })
      }
      return
    }
    const brief = finalizeBrief(result.data)
    const id = brief.id as string
    if (seenIds.has(id)) {
      issues.push({
        path: [prefix, "id"].filter(Boolean).join("."),
        message: `Duplicate campaign id "${id}"`,
      })
      return
    }
    seenIds.add(id)
    briefs.push(brief)
  })

  if (issues.length > 0) return { ok: false, format, issues }
  return { ok: true, format, briefs }
}

export function validateBrief(input: unknown): TCampaignBrief {
  return finalizeBrief(CampaignBriefSchema.parse(normalizeBriefInput(input)))
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
type TBriefFormat = "json" | "yaml"

export interface IParseIssue {
  path: string
  message: string
}

type TParseResult =
  | { ok: true; briefs: TCampaignBrief[]; format: TBriefFormat }
  | { ok: false; issues: IParseIssue[]; format: TBriefFormat | null }
