import type { IApiError, IAssetsListResponse, IAssetUploadResponse } from "@utils/api-types"
import { AssetError, type IAssetInfo, listAssets, saveAsset } from "@utils/server/assets"
import { NextResponse } from "next/server"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
export const runtime = "nodejs"

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function toSummary(a: IAssetInfo) {
  return { ...a, url: `/api/assets/${encodeURIComponent(a.name)}` }
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export async function GET() {
  const assets = await listAssets()
  return NextResponse.json<IAssetsListResponse>({
    assets: assets.map(toSummary),
  })
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json<IApiError>({ error: "Expected multipart form data" }, { status: 400 })
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json<IApiError>({ error: "No files provided" }, { status: 400 })
  }

  const result: IAssetUploadResponse = { saved: [], errors: [] }
  for (const file of files) {
    try {
      const data = Buffer.from(await file.arrayBuffer())
      const { asset, reused } = await saveAsset(file.name, data)
      result.saved.push({ ...toSummary(asset), reused })
    } catch (err) {
      const message = err instanceof AssetError ? err.message : "Upload failed"
      result.errors.push({ name: file.name, message })
    }
  }
  return NextResponse.json(result, {
    status: result.saved.length > 0 ? 200 : 400,
  })
}
