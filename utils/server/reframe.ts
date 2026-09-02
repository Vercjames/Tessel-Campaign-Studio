import "server-only"
import { type IReframePlan, planReframe } from "@utils/brief/reframe"
import type { TAspectRatio } from "@utils/brief/schema"
import sharp from "sharp"

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
async function dimensions(image: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(image).metadata()
  if (!meta.width || !meta.height) throw new Error("Image has no dimensions")
  return { width: meta.width, height: meta.height }
}

// NOTE: The average color of the master fills the new bands before the model paints them
async function fillColor(image: Buffer): Promise<{ r: number; g: number; b: number }> {
  const stats = await sharp(image).stats()
  const [r, g, b] = stats.channels.map((c) => Math.round(c.mean))
  return { r: r ?? 128, g: g ?? 128, b: b ?? 128 }
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export async function planFor(master: Buffer, target: TAspectRatio): Promise<IReframePlan> {
  const { width, height } = await dimensions(master)
  return planReframe(width, height, target)
}

// NOTE: A crop is the master itself, so every pixel it shows is identical to the master
export async function cropMaster(master: Buffer, plan: IReframePlan): Promise<Buffer> {
  return sharp(master)
    .extract({ left: plan.offsetX, top: plan.offsetY, width: plan.canvasWidth, height: plan.canvasHeight })
    .png()
    .toBuffer()
}

// NOTE: The master sits untouched in the middle of a larger canvas; only the bands are blank
export async function padMaster(master: Buffer, plan: IReframePlan): Promise<Buffer> {
  const fill = await fillColor(master)
  return sharp({
    create: { width: plan.canvasWidth, height: plan.canvasHeight, channels: 3, background: fill },
  })
    .composite([{ input: master, left: plan.offsetX, top: plan.offsetY }])
    .png()
    .toBuffer()
}

// NOTE: Whatever the model returned, the master's own pixels are laid back over their exact region
// ↪ ERGO: Products, angles, lighting and type cannot drift; only the new bands come from the model
export async function restoreMaster(modelOutput: Buffer, master: Buffer, plan: IReframePlan): Promise<Buffer> {
  const resized = await sharp(modelOutput).resize(plan.canvasWidth, plan.canvasHeight, { fit: "fill" }).png().toBuffer()
  return sharp(resized)
    .composite([{ input: master, left: plan.offsetX, top: plan.offsetY }])
    .png()
    .toBuffer()
}
