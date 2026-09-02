import { AssetError, loadAsset } from "@utils/server/assets"
import { NextResponse } from "next/server"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
export const runtime = "nodejs"

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export async function GET(_req: Request, ctx: RouteContext<"/api/assets/[name]">) {
  const { name } = await ctx.params
  try {
    const asset = await loadAsset(decodeURIComponent(name))
    return new NextResponse(new Uint8Array(asset.data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.size),
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (err) {
    const status = err instanceof AssetError ? err.status : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status })
  }
}
