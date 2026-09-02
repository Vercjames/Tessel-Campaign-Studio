import type { IApiError, IGenerateResponse, IOutputsListResponse } from "@utils/api-types"
import { listOutputs } from "@utils/server/outputs"
import { NextResponse } from "next/server"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
export const runtime = "nodejs"

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
// ↪ CONTEXT: Sidecars written before runs existed carry no run id and are grouped under "earlier"
export async function GET(req: Request) {
  const campaign = new URL(req.url).searchParams.get("campaign")?.trim()
  if (!campaign) return NextResponse.json<IApiError>({ error: "Missing campaign" }, { status: 400 })
  const metas = await listOutputs(campaign)
  const outputs: IGenerateResponse[] = metas.map(({ image, ...meta }) => ({
    ...meta,
    runId: meta.runId ?? "earlier",
    imageUrl: image.url,
    imagePath: image.relPath,
    reviewUrl: image.reviewUrl,
    mimeType: image.mimeType,
  }))
  return NextResponse.json<IOutputsListResponse>({ outputs })
}
