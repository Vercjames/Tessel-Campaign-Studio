import { slugify } from "@utils/brief/parse"
import type { TAspectRatio, TCampaignBrief } from "@utils/brief/schema"

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export function campaignSlug(brief: TCampaignBrief): string {
  return brief.id ?? slugify(brief.name ?? "campaign")
}

export function assetsForBrief(brief: TCampaignBrief): string[] {
  const names: string[] = []
  if (brief.brand?.logo && brief.logoPlacement.length > 0) names.push(brief.brand.logo)
  for (const product of brief.products) names.push(...(product.referenceImages ?? []).map((r) => r.file))
  return Array.from(new Set(names))
}

// NOTE: First locale at the first ratio is the master; every other variant is derived from it
export function masterVariant(brief: TCampaignBrief): IMasterVariant {
  return { locale: brief.locales[0], aspectRatio: brief.aspectRatio[0] }
}

export function jobId(campaignId: string, locale: string, aspectRatio: TAspectRatio): string {
  return `${campaignId}/${locale}/${aspectRatio.replace(":", "x")}`
}

// NOTE: One job per locale x aspect ratio. Every locale's first ratio derives from the master; every other
// ↪ ratio derives from its own locale's first ratio, so ratio variants are re-framed pixels of the same picture
export function expandJobs(brief: TCampaignBrief): IGenerationJob[] {
  const campaignId = campaignSlug(brief)
  const master = masterVariant(brief)
  const masterId = jobId(campaignId, master.locale, master.aspectRatio)
  const assetNames = assetsForBrief(brief)
  const jobs: IGenerationJob[] = []
  for (const locale of brief.locales) {
    const localeMasterId = jobId(campaignId, locale, master.aspectRatio)
    for (const aspectRatio of brief.aspectRatio) {
      const id = jobId(campaignId, locale, aspectRatio)
      const parentId = id === masterId ? null : aspectRatio === master.aspectRatio ? masterId : localeMasterId
      jobs.push({
        id,
        masterId: parentId,
        campaignId,
        campaignName: brief.name ?? campaignId,
        aspectRatio,
        locale,
        assetNames,
      })
    }
  }
  return jobs
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface IMasterVariant {
  locale: string
  aspectRatio: TAspectRatio
}

export interface IGenerationJob {
  id: string
  masterId: string | null
  campaignId: string
  campaignName: string
  aspectRatio: TAspectRatio
  locale: string
  assetNames: string[]
}
