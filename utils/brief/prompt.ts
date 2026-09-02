import { LANGUAGE_NAMES, type TAspectRatio, type TCampaignBrief, type TReferenceRole } from "@utils/brief/schema"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const FORMAT_HINTS: Record<TAspectRatio, string> = {
  "1:1": "square social feed post",
  "2:3": "tall portrait print or pin",
  "3:2": "landscape editorial",
  "3:4": "portrait social post",
  "4:3": "landscape presentation slide",
  "9:16": "vertical story / reel",
  "16:9": "widescreen banner or display ad",
  "21:9": "ultra-wide web hero banner",
}

const ROLE_GUIDANCE: Record<TReferenceRole, string> = {
  product: "reproduce this item's real shape, colors, materials and details from it",
  background: "use it as the setting and environment behind the products",
  atmosphere: "match its atmosphere: lighting, mood and overall feel",
  composition: "follow its layout, framing and use of negative space",
  palette: "take the color palette from it",
}

// NOTE: Hue buckets end at these degrees; the last entry wraps back to red
const HUE_NAMES: Array<[number, string]> = [
  [15, "red"],
  [30, "orange-red"],
  [50, "orange"],
  [68, "yellow"],
  [95, "lime green"],
  [150, "green"],
  [190, "teal"],
  [215, "cyan blue"],
  [255, "blue"],
  [290, "violet"],
  [330, "magenta"],
  [360, "red"],
]

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function cornerWords(position: TCampaignBrief["logoPosition"]): string {
  return position.replace("-", " ")
}

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export function languageName(locale: string): string {
  const base = locale.toLowerCase().split("-")[0]
  const name = LANGUAGE_NAMES[base]
  if (!name) return locale
  const region = locale.includes("-") ? ` (${locale})` : ""
  return `${name}${region}`
}

// NOTE: Hex codes in a prompt tend to get painted into the picture as text
// ↪ ERGO: Every brand color is spoken about in plain words instead
export function colorName(hex: string): string {
  const raw = hex.replace("#", "")
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw
  const r = Number.parseInt(full.slice(0, 2), 16) / 255
  const g = Number.parseInt(full.slice(2, 4), 16) / 255
  const b = Number.parseInt(full.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let hue = 0
  if (d > 0) {
    if (max === r) hue = ((g - b) / d) % 6
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  if (l > 0.96) return "white"
  if (l < 0.08) return "black"
  if (s < 0.12) return l > 0.8 ? "light gray" : l > 0.45 ? "gray" : l > 0.25 ? "dark gray" : "charcoal"
  if (l > 0.85 && s < 0.6) return hue >= 20 && hue <= 70 ? "off-white cream" : "pale off-white"
  if (hue >= 30 && hue <= 50 && s > 0.6 && l > 0.35 && l < 0.65) return "amber"
  const base = HUE_NAMES.find(([limit]) => hue <= limit)?.[1] ?? "red"
  const mod = l > 0.85 ? "pale " : l > 0.65 ? "light " : l < 0.3 ? "deep " : ""
  return `${mod}${base}`
}

// NOTE: The single campaign message is the only text; blank means a text-free image
export function resolveHeadline(brief: TCampaignBrief): string | null {
  const text = (brief.message ?? "").trim()
  return text.length > 0 ? text : null
}

// NOTE: Each color is named with its job so the model knows where to spend it
function describePalette(colors: NonNullable<TCampaignBrief["brand"]>["colors"] | undefined): string | null {
  if (!colors) return null
  const parts: string[] = []
  if (colors.primary) parts.push(`primary ${colorName(colors.primary)} for key surfaces and brand accents`)
  if (colors.secondary) parts.push(`secondary ${colorName(colors.secondary)} for backgrounds and supporting surfaces`)
  if (colors.tone) parts.push(`tone ${colorName(colors.tone)} for highlights, small details and the color cast of the light`)
  return parts.length > 0 ? `Brand palette: ${parts.join("; ")}.` : null
}

// NOTE: The message is art-directed like an agency poster, not pasted on; contrast is chosen from the scene, not the primary
function typographyDirection(colors: NonNullable<TCampaignBrief["brand"]>["colors"] | undefined): string[] {
  const inks: string[] = []
  if (colors?.secondary) inks.push(`the secondary color (${colorName(colors.secondary)})`)
  inks.push("clean white", "deep near-black")
  const accent = colors?.tone
    ? ` A single small accent (a period, underline or one word) may use the tone color (${colorName(colors.tone)}).`
    : ""
  const avoidPrimary = colors?.primary
    ? ` Do not set the text in the primary ${colorName(colors.primary)} unless it is the highest-contrast choice.`
    : ""
  return [
    "Typography: the message is part of the design, as in finished promotional work from an agency. Set it in one clean modern sans-serif at display size with tight tracking, a clear hierarchy and generous margins.",
    `Place the message in the largest clear area of negative space, aligned to the frame (centered, or flush to a consistent margin), never touching the products or the reserved logo corner. Text ink: ${inks.join(", ")}, whichever gives the highest contrast against what is behind it.${avoidPrimary}${accent}`,
    "Every letter must be crisp, sharp-edged, correctly spelled and fully legible at a glance. If the background is busy, calm it behind the text with a soft natural falloff of light or depth of field rather than a box.",
  ]
}

function describeRoles(roles: TReferenceRole[]): string {
  return `${roles.join(" + ")} reference`
}

// NOTE: Deterministic for a given brief; every item is composed into one scene
// ↪ CONTEXT: "locale" reuses the master picture with new wording; "reframe" re-composes it for another aspect ratio
export function buildPrompt(brief: TCampaignBrief, locale: string, aspectRatio: TAspectRatio, master?: IMasterReference): IBuiltPrompt {
  const headline = resolveHeadline(brief)
  const campaignName = brief.name?.trim() || "campaign"
  const subjects = brief.products.filter((p) => p.kind === "product")
  const composition = brief.products.filter((p) => p.kind === "composition")
  const subjectNames = subjects.map((p) => p.name).join(", ") || "the products"
  const corner = cornerWords(brief.logoPosition)
  const logo = brief.brand?.logo
  const onProducts = Boolean(logo) && brief.logoPlacement.includes("product")
  const inCorner = Boolean(logo) && brief.logoPlacement.includes("corner")

  // NOTE: A re-composition attaches only the master; product and logo references would invite a second scene or a duplicate
  const reframe = master?.mode === "reframe"
  const references: IReferenceLabel[] = []
  if (master) references.push({ name: master.name, role: "master", roles: [], item: null })
  if (logo && onProducts && !reframe) references.push({ name: logo, role: "logo", roles: [], item: null })
  if (!reframe) {
    for (const item of brief.products) {
      for (const r of item.referenceImages ?? []) {
        references.push({ name: r.file, role: `${describeRoles(r.roles)} for ${item.name}`, roles: r.roles, item: item.name })
      }
    }
  }

  const lines: string[] = []
  lines.push(
    `Create one finished, print-ready ${FORMAT_HINTS[aspectRatio]} (${aspectRatio}) advertising image for the "${campaignName}" campaign: a single composed scene.`,
  )
  if (master) {
    lines.push(
      "Image 1 is the approved master image for this campaign. Reproduce it faithfully: the same scene, subjects, props, lighting, colors, composition and mood, so the result reads as the same photograph.",
    )
    if (master.mode === "reframe") {
      lines.push(
        `The master is ${master.aspectRatio} (${FORMAT_HINTS[master.aspectRatio]}). Re-compose it for ${aspectRatio} (${FORMAT_HINTS[aspectRatio]}) the way a designer adapts one creative to a new format.`,
        "Keep every product at the same angle, scale relationship, materials and lighting, and keep the message in the same wording, typeface, weight and color. Reveal more of the scene in the new direction rather than cropping; nothing from the master may be cut off or pushed out of frame.",
        "Move the message and products only as far as the new frame requires, keeping the message fully inside the frame with generous margins and in clear space.",
        "Render one continuous scene in a single frame: no split panels, collage, borders or insets, and each product appears exactly once, as it does in the master.",
      )
    }
    if (master.locale !== locale && headline) {
      lines.push(
        `Only change the message wording for locale ${locale}; keep its typeface, weight, color, size and position as in the master.`,
      )
    }
  }

  if (subjects.length > 0) {
    lines.push(
      subjects.length === 1
        ? `Feature this product: ${subjects[0].name}. ${subjects[0].description}`
        : `Feature these products together in the same scene, each clearly visible and naturally arranged: ${subjects
            .map((p) => `${p.name} (${p.description})`)
            .join("; ")}.`,
    )
  }
  if (composition.length > 0) {
    lines.push(`Scene composition and atmosphere: ${composition.map((p) => `${p.name}: ${p.description}`).join("; ")}.`)
  }
  if (brief.region?.trim()) {
    lines.push(`Target market: ${brief.region.trim()}. Make the setting, casting, light and cultural cues feel native to this market.`)
  }
  if (brief.audience?.trim()) {
    lines.push(`Target audience: ${brief.audience.trim()}. The image should feel made for them.`)
  }

  if (headline) {
    const isEnglish = locale.toLowerCase().startsWith("en")
    lines.push(`Campaign message to render exactly once: "${headline}"`)
    lines.push(...typographyDirection(brief.brand?.colors))
    if (!isEnglish) {
      lines.push(
        `Locale ${locale}: render the message in ${languageName(locale)}, translated naturally from the English above. Keep brand and product names unchanged. Spell every word correctly.`,
      )
    }
  } else {
    lines.push("Render no text at all: no headline, captions or labels.")
  }

  const palette = describePalette(brief.brand?.colors)
  if (palette) lines.push(palette)

  if (inCorner) {
    lines.push(
      `Keep the ${corner} corner of the frame clear: no subjects, text or marks within roughly 16% of the width and 20% of the height of that corner. The brand mark is placed there afterwards; do not draw a logo.`,
    )
  }

  if (references.length > 0) {
    const attached = references.map((r, i) => `image ${i + 1} is the ${r.role} (${r.name})`).join("; ")
    lines.push(`Attached references: ${attached}.`)
    if (logo && onProducts && !reframe) {
      const logoIndex = references.findIndex((r) => r.role === "logo") + 1
      lines.push(
        `Apply image ${logoIndex}, the logo, onto every featured product: ${subjectNames}. Each of these products must carry it once, as a printed or embossed brand mark on its main visible surface, sized like a real product logo (roughly a fifth of the product's width).`,
        `Treat the logo as an exact vector mark: identical proportions, letterforms, shapes and colors as image ${logoIndex}. Do not redraw, simplify, embellish, recolor, mirror or add text to it. Only natural perspective and surface curvature may affect it; it stays upright and undistorted.`,
      )
    }
    references.forEach((r, i) => {
      if (r.roles.length === 0) return
      const guidance = r.roles.map((role) => ROLE_GUIDANCE[role]).join("; ")
      lines.push(`Image ${i + 1}${r.item ? ` (${r.item})` : ""}: ${guidance}.`)
    })
  }

  const avoid = brief.avoid ? ` Avoid: ${brief.avoid}.` : ""
  lines.push(
    `Rules: no other text of any kind (no color codes, file names, captions, watermarks or UI); keep the products the focal point; leave breathing room${headline ? " around the message" : ""}.${avoid}`,
  )

  const checks = ["every product is clearly visible"]
  if (headline) checks.push("the message is present once, crisp and legible, placed in clear space")
  if (inCorner) checks.push(`the ${corner} corner is clear for the brand mark`)
  if (onProducts) checks.push(`the logo appears exactly as provided on each product: ${subjectNames}`)
  lines.push(`Before finishing, confirm: ${checks.join("; ")}.`)

  return { text: lines.join("\n"), references, headline }
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface IReferenceLabel {
  name: string
  role: string
  roles: TReferenceRole[]
  item: string | null
}

interface IBuiltPrompt {
  text: string
  references: IReferenceLabel[]
  headline: string | null
}

interface IMasterReference {
  name: string
  locale: string
  aspectRatio: TAspectRatio
  mode: "locale" | "reframe"
}
