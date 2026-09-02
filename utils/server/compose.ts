import "server-only"
import type { TLogoPosition } from "@utils/brief/schema"
import sharp from "sharp"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const LOGO_WIDTH_RATIO = 0.08
const LOGO_MARGIN_RATIO = 0.04

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
// NOTE: Places the exact logo file onto a rendered image so the mark is never redrawn by the model
export async function overlayLogo(base: Buffer, logo: Buffer, position: TLogoPosition): Promise<Buffer> {
  const meta = await sharp(base).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width === 0 || height === 0) throw new Error("Rendered image has no dimensions")

  const logoWidth = Math.max(24, Math.round(width * LOGO_WIDTH_RATIO))
  const margin = Math.round(Math.min(width, height) * LOGO_MARGIN_RATIO)
  const mark = await sharp(logo).resize({ width: logoWidth, fit: "inside" }).png().toBuffer()
  const markMeta = await sharp(mark).metadata()
  const markWidth = markMeta.width ?? logoWidth
  const markHeight = markMeta.height ?? logoWidth

  const left = position.endsWith("left") ? margin : width - margin - markWidth
  const top = position.startsWith("top") ? margin : height - margin - markHeight

  return sharp(base)
    .composite([{ input: mark, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toBuffer()
}
