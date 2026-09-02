import type { TAspectRatio, TCampaignBrief } from "@utils/brief/schema"

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
export interface IHealthResponse {
  geminiConfigured: boolean
  model: string
  assetsDir: string
  outputsDir: string
}

export interface IAssetSummary {
  name: string
  mimeType: string
  size: number
  modifiedAt: string
  url: string
}

export interface IAssetsListResponse {
  assets: IAssetSummary[]
}

export interface IAssetUploadResponse {
  saved: Array<IAssetSummary & { reused: boolean }>
  errors: Array<{ name: string; message: string }>
}

export interface IGenerateRequest {
  brief: TCampaignBrief
  locale: string
  aspectRatio: TAspectRatio
  runId: string
  masterPath?: string
}

export interface IGenerateResponse {
  jobId: string
  runId: string
  masterJobId: string | null
  campaignId: string
  campaignName: string
  aspectRatio: string
  locale: string
  imageUrl: string
  imagePath: string
  reviewUrl: string
  mimeType: string
  model: string
  prompt: string
  headline: string | null
  assetsUsed: string[]
  assetsMissing: string[]
  note: string | null
  createdAt: string
}

export interface IOutputsListResponse {
  outputs: IGenerateResponse[]
}

export interface IApiError {
  error: string
  code?: TApiErrorCode
  details?: unknown
}

export type TApiErrorCode = "legal"
