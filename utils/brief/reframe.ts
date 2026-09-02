import type { TAspectRatio } from "@utils/brief/schema"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
// NOTE: Ratios within this factor of the master are cropped; anything further is extended
const CROP_TOLERANCE = 1.25

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function ratioValue(ratio: TAspectRatio): number {
  const [w, h] = ratio.split(":").map(Number)
  return w / h
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
// NOTE: Pure geometry so the decision is testable without touching image data
// ↪ ERGO: crop keeps every pixel it shows; extend keeps every master pixel and adds bands to fill
export function planReframe(width: number, height: number, target: TAspectRatio): IReframePlan {
  const current = width / height
  const wanted = ratioValue(target)
  const spread = Math.max(current, wanted) / Math.min(current, wanted)

  if (spread <= CROP_TOLERANCE) {
    const cropW = wanted >= current ? width : Math.round(height * wanted)
    const cropH = wanted >= current ? Math.round(width / wanted) : height
    return {
      mode: "crop",
      canvasWidth: cropW,
      canvasHeight: cropH,
      offsetX: Math.round((width - cropW) / 2),
      offsetY: Math.round((height - cropH) / 2),
      sourceWidth: width,
      sourceHeight: height,
    }
  }

  const canvasWidth = wanted >= current ? Math.round(height * wanted) : width
  const canvasHeight = wanted >= current ? height : Math.round(width / wanted)
  return {
    mode: "extend",
    canvasWidth,
    canvasHeight,
    offsetX: Math.round((canvasWidth - width) / 2),
    offsetY: Math.round((canvasHeight - height) / 2),
    sourceWidth: width,
    sourceHeight: height,
  }
}

export function describeBands(plan: IReframePlan): string {
  return plan.canvasWidth > plan.sourceWidth ? "left and right" : "top and bottom"
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
type TReframeMode = "crop" | "extend"

export interface IReframePlan {
  mode: TReframeMode
  canvasWidth: number
  canvasHeight: number
  offsetX: number
  offsetY: number
  sourceWidth: number
  sourceHeight: number
}
