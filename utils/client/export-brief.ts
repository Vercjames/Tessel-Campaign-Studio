import { draftToInput, type ICampaignDraft } from "@utils/brief/draft"
import { slugify } from "@utils/brief/parse"
import { dump } from "js-yaml"

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function cleanInput(draft: ICampaignDraft): Record<string, unknown> {
  const raw = draftToInput(draft) as Record<string, unknown>
  const { name, ...rest } = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>
  return { campaign: name, ...rest }
}

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
function serializeDraft(draft: ICampaignDraft, format: TExportFormat): string {
  const data = cleanInput(draft)
  if (format === "json") return `${JSON.stringify(data, null, 2)}\n`
  return dump(data, { lineWidth: 100, noRefs: true })
}

function exportFileName(draft: ICampaignDraft, format: TExportFormat): string {
  const base = draft.id.trim() || slugify(draft.name || "campaign")
  return `${base}.${format === "json" ? "json" : "yaml"}`
}

function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // NOTE: Revoke on the next tick so the click has started the download first
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function exportDraft(draft: ICampaignDraft, format: TExportFormat): void {
  const mime = format === "json" ? "application/json" : "application/yaml"
  downloadText(exportFileName(draft, format), serializeDraft(draft, format), mime)
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
type TExportFormat = "yaml" | "json"
