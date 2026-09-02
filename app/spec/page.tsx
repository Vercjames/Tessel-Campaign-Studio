import { ExampleDownloads } from "@comps/campaign/example-downloads"
import { Badge } from "@comps/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@comps/ui/card"
import { ASPECT_RATIOS, briefJsonSchema, COMPOSITION_ROLES, LOGO_PLACEMENTS, LOGO_POSITIONS, PRODUCT_KINDS } from "@utils/brief/schema"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
export const metadata: Metadata = {
  title: "Brief spec · Tessel Campaign Studio",
  description: "Fields and JSON Schema for a Tessel campaign brief.",
}

const CAMPAIGN_FIELDS: IFieldDoc[] = [
  { name: "campaign / name", type: "string", description: "Campaign name. Either key works." },
  { name: "id", type: "slug", description: "Optional stable id. Derived from the name when omitted. Names the output folder." },
  { name: "region", type: "string", description: "Target region or market. Drives setting, casting and cultural cues." },
  { name: "audience", type: "string", description: "Who the campaign speaks to." },
  { name: "message", type: "string", description: "The one line of text rendered on the image. Omit for a text-free image." },
  {
    name: "locales",
    type: "string[] (1 to 6)",
    description: "BCP-47 codes such as en, es, pt-BR. One image per locale per aspect ratio, message translated. Default [en].",
  },
  {
    name: "aspectRatio",
    type: `(${ASPECT_RATIOS.join(" | ")})[]`,
    description: 'Aspect ratios to render, one image each. A single string is also accepted. Default ["1:1"].',
  },
  { name: "brand", type: "object", description: "Optional shared brand identity and logo. See Brand below." },
  {
    name: "logoPlacement",
    type: `(${LOGO_PLACEMENTS.join(" | ")})[]`,
    description:
      "Any of corner (overlay, see logoPosition) and product (applied onto the featured products). Empty for no logo. Default [corner].",
  },
  {
    name: "logoPosition",
    type: LOGO_POSITIONS.join(" | "),
    description: "Corner for the logo overlay when logoPlacement includes corner. Default top-right.",
  },
  { name: "avoid", type: "string", description: "Things to keep out of the image." },
  {
    name: "products",
    type: "Item[] (1 to 12)",
    required: true,
    description: "Everything composed into the one campaign image: products to feature and composition references.",
  },
]

const BRAND_FIELDS: IFieldDoc[] = [
  {
    name: "brand.logo",
    type: "asset",
    description: "Shared logo file, placed per the campaign's logoPlacement.",
  },
  {
    name: "brand.colors.primary",
    type: "hex",
    description: "Dominant brand color: key surfaces, the message and logo accents.",
  },
  {
    name: "brand.colors.secondary",
    type: "hex",
    description: "Supporting color: backgrounds and secondary surfaces that sit against primary.",
  },
  {
    name: "brand.colors.tone",
    type: "hex",
    description: "Tonal accent: highlights, small details and the overall color cast of light and mood.",
  },
]

const PRODUCT_FIELDS: IFieldDoc[] = [
  { name: "id", type: "slug", description: "Optional stable id. Derived from the name when omitted." },
  { name: "name", type: "string", required: true, description: "Item name as it should be understood in the scene." },
  {
    name: "description",
    type: "string",
    required: true,
    description: "How the item looks in the final image. Stands in for a product image, or adds detail alongside reference images.",
  },
  {
    name: "kind",
    type: PRODUCT_KINDS.join(" | "),
    description:
      "product: a subject that must appear (default); its reference images are product shots. composition: background, atmosphere, layout or palette for the whole scene.",
  },
  {
    name: "referenceImages",
    type: "(asset | { file, roles[] })[] (max 6)",
    description: `Product items: bare filenames, always product shots. Composition items: a filename (background) or { file, roles } with roles from ${COMPOSITION_ROLES.join(", ")}.`,
  },
]

const EXAMPLE = `campaign: Summer Fitness Program
region: Southwest US
audience: Active adults 25–40 seeking a summer fitness program
message: Find out how to get started.
locales: [en]
aspectRatio: ["16:9", "1:1"]
products:
  - name: Gym Towel
    description: A folded charcoal microfiber towel with a woven teal edge
  - name: Water Bottle
    description: Our member only matte black insulated bottle
    referenceImages: [modern-waterbottle.png]
  - name: Modern gym
    kind: composition
    description: Bright modern gym floor at golden hour, polished concrete, soft haze
    referenceImages:
      - { file: modern-gym.png, roles: [background, atmosphere] }`

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function FieldTable({ fields }: { fields: IFieldDoc[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-t align-top">
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                {f.name}
                {f.required ? <span className="ml-1 text-destructive">*</span> : null}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{f.type}</td>
              <td className="px-3 py-2 text-muted-foreground">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export default function SpecPage() {
  const schema = JSON.stringify(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "CampaignBrief",
      ...briefJsonSchema(),
    },
    null,
    2,
  )

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to studio
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Campaign brief specification</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            One campaign per file. All items are composed into one image, rendered once per aspect ratio per locale. Asset fields are bare
            filenames that must exist in the asset library.
          </p>
        </div>
        <ExampleDownloads />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Minimal example</CardTitle>
          <CardDescription>Everything beyond the first six keys is optional and can be set in the studio after loading.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* biome-ignore format: pre content stays on its own line */}
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
{EXAMPLE}
</pre>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Campaign</h2>
          <Badge variant="secondary">* required</Badge>
        </div>
        <FieldTable fields={CAMPAIGN_FIELDS} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Brand (optional)</h2>
        <FieldTable fields={BRAND_FIELDS} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Item</h2>
        <FieldTable fields={PRODUCT_FIELDS} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">JSON Schema</h2>
        </div>
        {/* biome-ignore format: pre content stays on its own line */}
        <pre className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
{schema}
</pre>
      </section>
    </main>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface IFieldDoc {
  name: string
  type: string
  required?: boolean
  description: string
}
