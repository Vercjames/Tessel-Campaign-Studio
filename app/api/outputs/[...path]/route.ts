import { readOutput } from "@utils/server/outputs"
import { NextResponse } from "next/server"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
export const runtime = "nodejs"

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export async function GET(_req: Request, ctx: RouteContext<"/api/outputs/[...path]">) {
  const { path } = await ctx.params
  const result = await readOutput(path.map((s) => decodeURIComponent(s)))
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Length": String(result.data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
