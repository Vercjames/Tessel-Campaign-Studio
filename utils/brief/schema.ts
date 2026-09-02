import { z } from "zod"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
export const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"] as const

export const LOGO_PLACEMENTS = ["corner", "product"] as const
export const LOGO_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const
export const REFERENCE_ROLES = ["product", "background", "atmosphere", "composition", "palette"] as const
export const COMPOSITION_ROLES = ["background", "atmosphere", "composition", "palette"] as const
export const PRODUCT_KINDS = ["product", "composition"] as const

export const ASSET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]*\.(png|jpe?g|webp|heic|heif)$/i

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  sv: "Swedish",
  pl: "Polish",
  tr: "Turkish",
}

export const LOCALE_OPTIONS = [...Object.keys(LANGUAGE_NAMES), "en-GB", "es-MX", "pt-BR", "fr-CA", "zh-TW"]

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "must be a lowercase slug (a-z, 0-9, hyphens)")

const assetName = z
  .string()
  .trim()
  .min(1)
  .regex(ASSET_NAME_PATTERN, "Asset names must be a bare filename ending in .png, .jpg, .jpeg, .webp, .heic or .heif")
  .describe("Filename of an image in the asset library. No paths, just the filename.")

const hexColor = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Colors must be hex, e.g. #0E7C86")

const localeCode = z
  .string()
  .trim()
  .regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, "Locales are BCP-47 codes such as en, es or pt-BR")

const aspectRatio = z.enum(ASPECT_RATIOS)

// NOTE: A bare ratio string is widened to a one-item array
const aspectRatioList = z
  .union([aspectRatio, z.array(aspectRatio).min(1).max(ASPECT_RATIOS.length)])
  .default(["1:1"])
  .transform((v) => Array.from(new Set(Array.isArray(v) ? v : [v])))
  .describe('Output aspect ratios for the campaign image, one render each. Default ["1:1"].')

// NOTE: A bare filename inherits its role from the item: product items make it a product reference,
// ↪ HOWEVER: composition items make it a background reference; an object can name several roles
const referenceImage = z
  .union([
    assetName,
    z
      .object({
        file: assetName,
        roles: z.array(z.enum(REFERENCE_ROLES)).min(1).describe("What the image is a reference for."),
      })
      .strict(),
  ])
  .transform((v) =>
    typeof v === "string" ? { file: v, roles: [] as TReferenceRole[] } : { file: v.file, roles: Array.from(new Set(v.roles)) },
  )

// NOTE: A single string, including the old "none", is still accepted and widened
const logoPlacementList = z
  .union([z.enum([...LOGO_PLACEMENTS, "none"]), z.array(z.enum(LOGO_PLACEMENTS))])
  .default(["corner"])
  .transform((v) => (Array.isArray(v) ? Array.from(new Set(v)) : v === "none" ? [] : [v]))
  .describe("Where the shared logo appears: any of corner, product. Empty for no logo. Default [corner].")

const BrandColorsSchema = z
  .object({
    primary: hexColor.optional().describe("Dominant brand color: key surfaces, the message, logo accents."),
    secondary: hexColor.optional().describe("Supporting color: backgrounds, secondary surfaces, contrast against primary."),
    tone: hexColor.optional().describe("Tonal accent: highlights, small details, the overall color cast of light and mood."),
  })
  .strict()

const BrandSchema = z
  .object({
    logo: assetName.optional().describe("Shared logo asset placed per logoPlacement."),
    colors: BrandColorsSchema.optional().describe("Brand palette by role. Each entry is a hex color."),
  })
  .strict()

const ProductSchema = z
  .object({
    id: slug.optional().describe("Optional stable slug. Derived from name when omitted."),
    name: z.string().trim().min(1).describe("Item name as it should be understood in the scene."),
    description: z
      .string()
      .trim()
      .min(1)
      .describe("What it looks like. Stands in for, or adds to, a product image when describing the final composition."),
    kind: z
      .enum(PRODUCT_KINDS)
      .default("product")
      .describe(
        "product: a subject to feature; its reference images are product shots. composition: background, atmosphere, layout or palette for the whole scene.",
      ),
    referenceImages: z
      .array(referenceImage)
      .max(6)
      .optional()
      .describe(
        "Reference images from the asset library. Product items take bare filenames. Composition items take a filename (background) or { file, roles } with roles from background, atmosphere, composition, palette.",
      ),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.kind !== "composition") return
    item.referenceImages?.forEach((r, i) => {
      if (r.roles.includes("product")) {
        ctx.addIssue({
          code: "custom",
          path: ["referenceImages", i, "roles"],
          message: "Composition items cannot carry product references. Use background, atmosphere, composition or palette.",
        })
      }
    })
  })
  .transform((item) => ({
    ...item,
    referenceImages: item.referenceImages?.map((r) => ({
      file: r.file,
      roles: (item.kind === "product" ? ["product"] : r.roles.length > 0 ? r.roles : ["background"]) as TReferenceRole[],
    })),
  }))

export const CampaignBriefSchema = z
  .object({
    id: slug.optional().describe("Optional stable slug. Names the output folder."),
    name: z.string().trim().optional().describe("Campaign name. `campaign:` is accepted as an alias."),
    region: z.string().trim().optional().describe("Target region or market, e.g. 'Southwest US'."),
    audience: z.string().trim().optional().describe("Target audience, e.g. 'active adults 25-40'."),
    message: z.string().trim().optional().describe("Campaign message rendered on the image. Omit for no text."),
    locales: z
      .array(localeCode)
      .min(1)
      .max(6)
      .default(["en"])
      .describe("Locales to render, one image per locale per aspect ratio. Default [en]."),
    aspectRatio: aspectRatioList,
    brand: BrandSchema.optional().describe("Optional shared brand identity and logo."),
    logoPlacement: logoPlacementList,
    logoPosition: z
      .enum(LOGO_POSITIONS)
      .default("top-right")
      .describe("Corner for the logo overlay when logoPlacement includes corner. Default top-right."),
    avoid: z.string().trim().optional().describe("Things to keep out of the image."),
    products: z
      .array(ProductSchema)
      .min(1, "A campaign needs at least one item")
      .max(12)
      .describe("Items composed together into the one campaign image: products to feature plus composition references."),
  })
  .strict()

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
// NOTE: `campaign:` is the friendlier key for the campaign name and is folded into `name`
// ↪ CONTEXT: Runs before validation so the strict schema does not reject the alias
export function normalizeBriefInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw
  const obj = raw as Record<string, unknown>
  if (typeof obj.campaign === "string" && obj.name === undefined) {
    const { campaign, ...rest } = obj
    return { ...rest, name: campaign }
  }
  return raw
}

export function briefJsonSchema() {
  const schema = z.toJSONSchema(CampaignBriefSchema, {
    io: "input",
    target: "draft-7",
  }) as Record<string, unknown> & { properties?: Record<string, unknown> }
  schema.properties = {
    campaign: { type: "string", description: "Alias for `name`. Use either." },
    ...schema.properties,
  }
  return schema
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
export type TAspectRatio = (typeof ASPECT_RATIOS)[number]

export type TLogoPlacement = (typeof LOGO_PLACEMENTS)[number]
export type TLogoPosition = (typeof LOGO_POSITIONS)[number]
export type TReferenceRole = (typeof REFERENCE_ROLES)[number]
export type TProductKind = (typeof PRODUCT_KINDS)[number]

export type TCampaignBrief = z.output<typeof CampaignBriefSchema>
