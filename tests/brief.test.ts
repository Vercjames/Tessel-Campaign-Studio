import { briefToDraft, draftToInput, emptyDraft, validateDraft } from "@utils/brief/draft"
import { assetsForBrief, expandJobs } from "@utils/brief/jobs"
import { parseBriefs, slugify } from "@utils/brief/parse"
import { buildPrompt, colorName, resolveHeadline } from "@utils/brief/prompt"
import { briefJsonSchema } from "@utils/brief/schema"
import { describe, expect, it } from "vitest"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const userYaml = `
campaign: Summer Fitness Program
region: Southwest US
audience: Active adults 25–40 seeking a summer fitness program
message: Find out how to get started.
locales: [en, es]
products:
  - id: towel
    name: Gym Towel
    description: A folded charcoal microfiber towel with a woven teal edge
  - id: water-bottle
    name: Water Bottle
    description: Our member only matte black insulated bottle
  - id: gym
    name: Modern gym
    kind: composition
    description: Bright modern gym floor at golden hour, polished concrete, soft haze
`

const fullYaml = `
name: Summer Hydration
region: US West Coast
audience: Outdoor athletes 25-40
message: Stay cool. Keep moving.
locales: [en]
aspectRatio: ["16:9", "1:1", "16:9"]
brand:
  logo: tessel-logo.png
  colors: { primary: "#0E7C86", secondary: "#F4F1EA" }
logoPlacement: [corner, product]
logoPosition: bottom-left
products:
  - name: Citrus Electrolyte Water
    description: A slim teal can with a citrus wedge motif.
    referenceImages: [citrus-can.png]
  - name: Boardwalk
    kind: composition
    description: A sunlit coastal boardwalk after a run.
    referenceImages:
      - { file: boardwalk.png, roles: [background, atmosphere, background] }
      - beach-light.png
`

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function sample(name: string) {
  return {
    name,
    region: "EU",
    audience: "Everyone",
    message: "Hi",
    brand: undefined as { logo?: string } | undefined,
    products: [{ name: "P1", description: "d" }],
  }
}

function mustParse(text: string) {
  const result = parseBriefs(text, "b.yaml")
  if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result.issues)}`)
  return result.briefs[0]
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
describe("parseBriefs", () => {
  it("parses the minimal yaml", () => {
    const brief = mustParse(userYaml)
    expect(brief.name).toBe("Summer Fitness Program")
    expect(brief.id).toBe("summer-fitness-program")
    expect(brief.locales).toEqual(["en", "es"])
    expect(brief.aspectRatio).toEqual(["1:1"])
    expect(brief.logoPlacement).toEqual(["corner"])
    expect(brief.logoPosition).toBe("top-right")
    expect(brief.products.map((p) => p.kind)).toEqual(["product", "product", "composition"])
    expect(brief.products[0].id).toBe("towel")
  })

  it("dedupes ratios, placements and roles", () => {
    const brief = mustParse(fullYaml)
    expect(brief.aspectRatio).toEqual(["16:9", "1:1"])
    expect(brief.logoPlacement).toEqual(["corner", "product"])
    expect(brief.logoPosition).toBe("bottom-left")
    expect(brief.products[0].referenceImages).toEqual([{ file: "citrus-can.png", roles: ["product"] }])
    expect(brief.products[1].referenceImages).toEqual([
      { file: "boardwalk.png", roles: ["background", "atmosphere"] },
      { file: "beach-light.png", roles: ["background"] },
    ])
  })

  it("needs at least one item", () => {
    expect(parseBriefs(JSON.stringify(sample("One")), "b.json").ok).toBe(true)
    const none = sample("None")
    none.products = []
    const result = parseBriefs(JSON.stringify(none), "b.json")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0].path).toBe("products")
  })

  it("product role only on product items", () => {
    const forced = mustParse(
      fullYaml.replace("referenceImages: [citrus-can.png]", "referenceImages: [{ file: citrus-can.png, roles: [background] }]"),
    )
    expect(forced.products[0].referenceImages).toEqual([{ file: "citrus-can.png", roles: ["product"] }])
    const refused = parseBriefs(fullYaml.replace("roles: [background, atmosphere, background]", "roles: [product]"), "b.yaml")
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.issues[0].path).toBe("products[1].referenceImages[0].roles")
  })

  it("rejects removed keys", () => {
    const legacy = { ...sample("Legacy"), brand: { colors: ["#0E7C86"] } }
    expect(parseBriefs(JSON.stringify(legacy), "b.json").ok).toBe(false)
    expect(parseBriefs(JSON.stringify({ ...sample("Style"), style: "photoreal" }), "b.json").ok).toBe(false)
    expect(parseBriefs(JSON.stringify({ ...sample("Tone"), brand: { tone: "warm" } }), "b.json").ok).toBe(false)
  })

  it("rejects bad ratios, kinds and asset paths", () => {
    const bad = sample("Bad") as ReturnType<typeof sample> & { aspectRatio?: unknown; products: Array<Record<string, unknown>> }
    bad.aspectRatio = ["5:7"]
    expect(parseBriefs(JSON.stringify(bad), "b.json").ok).toBe(false)
    bad.aspectRatio = undefined
    bad.products[0].kind = "prop"
    expect(parseBriefs(JSON.stringify(bad), "b.json").ok).toBe(false)
    bad.products[0].kind = undefined
    bad.brand = { logo: "../secret.png" }
    expect(parseBriefs(JSON.stringify(bad), "b.json").ok).toBe(false)
  })

  it("reports syntax errors", () => {
    const result = parseBriefs("{ not json", "b.json")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0].message).toMatch(/JSON syntax error/)
  })

  it("dedupes derived ids", () => {
    const s = sample("Same")
    s.products = [
      { name: "Bottle", description: "a" },
      { name: "Bottle", description: "b" },
    ]
    expect(mustParse(JSON.stringify(s)).products.map((p) => p.id)).toEqual(["bottle", "bottle-2"])
  })
})

describe("expandJobs", () => {
  it("one job per locale x ratio, master first", () => {
    const jobs = expandJobs(mustParse(userYaml))
    expect(jobs).toHaveLength(2)
    expect(jobs[0].id).toBe("summer-fitness-program/en/1x1")
    expect(jobs[0].masterId).toBeNull()
    expect(jobs[1].id).toBe("summer-fitness-program/es/1x1")
    expect(jobs[1].masterId).toBe("summer-fitness-program/en/1x1")
    expect(jobs[0].assetNames).toEqual([])
  })

  it("chains ratio variants off their own locale's first ratio", () => {
    const brief = mustParse(fullYaml.replace("locales: [en]", "locales: [en, es]"))
    const parent = Object.fromEntries(expandJobs(brief).map((j) => [j.id, j.masterId]))
    expect(parent["summer-hydration/en/16x9"]).toBeNull()
    expect(parent["summer-hydration/en/1x1"]).toBe("summer-hydration/en/16x9")
    expect(parent["summer-hydration/es/16x9"]).toBe("summer-hydration/en/16x9")
    expect(parent["summer-hydration/es/1x1"]).toBe("summer-hydration/es/16x9")
  })

  it("collects assets once", () => {
    const brief = mustParse(fullYaml)
    const jobs = expandJobs(brief)
    expect(jobs.map((j) => j.aspectRatio)).toEqual(["16:9", "1:1"])
    expect(assetsForBrief(brief)).toEqual(["tessel-logo.png", "citrus-can.png", "boardwalk.png", "beach-light.png"])
    expect(jobs[1].assetNames).toEqual(jobs[0].assetNames)
  })
})

describe("buildPrompt", () => {
  it("composes all items into one scene", () => {
    const brief = mustParse(userYaml)
    const en = buildPrompt(brief, "en", "1:1")
    expect(en.text).toContain("single composed scene")
    expect(en.text).toContain("Feature these products together")
    expect(en.text).toContain("Gym Towel")
    expect(en.text).toContain("Water Bottle")
    expect(en.text).toContain("Scene composition and atmosphere: Modern gym:")
    expect(en.text).toContain('"Find out how to get started."')
    expect(en.text).toContain("Southwest US")
    expect(en.references).toEqual([])
    const es = buildPrompt(brief, "es", "1:1")
    expect(es.text).toContain("Spanish")
  })

  it("labels references and logo placement", () => {
    const brief = mustParse(fullYaml)
    const prompt = buildPrompt(brief, "en", "16:9")
    expect(prompt.references.map((r) => r.name)).toEqual(["tessel-logo.png", "citrus-can.png", "boardwalk.png", "beach-light.png"])
    expect(prompt.references[2].role).toBe("background + atmosphere reference for Boardwalk")
    expect(prompt.text).toContain("Brand palette: primary deep teal for key surfaces")
    expect(prompt.text).toContain("secondary off-white cream for backgrounds")
    expect(prompt.text).not.toMatch(/#[0-9a-f]{3,6}\b/i)
    expect(prompt.text).toContain("Keep the bottom left corner of the frame clear")
    expect(prompt.text).toContain("do not draw a logo")
    expect(prompt.text).toContain("the logo, onto every featured product: Citrus Electrolyte Water.")
    expect(prompt.text).toContain("Treat the logo as an exact vector mark")
    expect(prompt.text).toContain("exactly as provided on each product: Citrus Electrolyte Water")
    expect(prompt.text).toContain("Image 3 (Boardwalk): use it as the setting")
  })

  it("message ink is contrast-led", () => {
    const brief = mustParse(fullYaml)
    const prompt = buildPrompt(brief, "en", "16:9")
    expect(prompt.text).toContain("Typography: the message is part of the design")
    expect(prompt.text).toContain("Text ink: the secondary color (off-white cream), clean white, deep near-black")
    expect(prompt.text).toContain("Do not set the text in the primary deep teal")
    expect(prompt.text).toContain("largest clear area of negative space")
    const bare = buildPrompt(mustParse(userYaml), "en", "1:1")
    expect(bare.text).toContain("Text ink: clean white, deep near-black")
  })

  it("keeps the logo out of the model's hands when it only goes in the corner", () => {
    const brief = mustParse(fullYaml.replace("logoPlacement: [corner, product]", "logoPlacement: [corner]"))
    const prompt = buildPrompt(brief, "en", "16:9")
    expect(prompt.references.map((r) => r.name)).not.toContain("tessel-logo.png")
    expect(prompt.text).toContain("Keep the bottom left corner of the frame clear")
    expect(prompt.text).toContain("the bottom left corner is clear for the brand mark")
    expect(prompt.text).not.toContain("onto the featured products")
  })

  it("names colors in words", () => {
    expect(colorName("#0E7C86")).toBe("deep teal")
    expect(colorName("#F4F1EA")).toBe("off-white cream")
    expect(colorName("#F59E0B")).toBe("amber")
    expect(colorName("#ffffff")).toBe("white")
    expect(colorName("#111")).toBe("black")
    expect(colorName("#808080")).toBe("gray")
  })

  it("no message, no text", () => {
    const brief = mustParse(userYaml.replace("message: Find out how to get started.\n", ""))
    expect(resolveHeadline(brief)).toBeNull()
    expect(buildPrompt(brief, "en", "1:1").text).toContain("Render no text at all")
  })

  it("locale variants keep the master and ratio variants re-compose it", () => {
    const brief = mustParse(fullYaml)
    const locale = buildPrompt(brief, "es", "16:9", { name: "m.png", locale: "en", aspectRatio: "16:9", mode: "locale" })
    expect(locale.references[0]).toEqual({ name: "m.png", role: "master", roles: [], item: null })
    expect(locale.text).toContain("Only change the message wording for locale es")
    expect(locale.text).not.toContain("Re-compose")
    const reframe = buildPrompt(brief, "en", "1:1", { name: "m.png", locale: "en", aspectRatio: "16:9", mode: "reframe" })
    expect(reframe.references).toEqual([{ name: "m.png", role: "master", roles: [], item: null }])
    expect(reframe.text).toContain("The master is 16:9")
    expect(reframe.text).toContain("exactly once")
    expect(reframe.text).not.toContain("Apply image")
    expect(reframe.text).toContain("Re-compose it for 1:1")
    expect(reframe.text).toContain("cut off")
    expect(reframe.text).toContain("Feature")
    expect(reframe.text).not.toContain("blank bands")
    expect(reframe.text).not.toContain("Only change the message wording")
  })

  it("is deterministic", () => {
    const brief = mustParse(userYaml)
    expect(buildPrompt(brief, "en", "1:1").text).toBe(buildPrompt(brief, "en", "1:1").text)
  })
})

describe("drafts", () => {
  it("round-trips through a draft", () => {
    const draft = briefToDraft(mustParse(fullYaml), "b.yaml")
    expect(draft.logo).toBe("tessel-logo.png")
    expect(draft.aspectRatios).toEqual(["16:9", "1:1"])
    expect(draft.logoPlacement).toEqual(["corner", "product"])
    expect(draft.products[1].kind).toBe("composition")
    const back = validateDraft(draft)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.brief.aspectRatio).toEqual(["16:9", "1:1"])
    expect(back.brief.logoPosition).toBe("bottom-left")
    expect(back.brief.products[1].referenceImages).toEqual([
      { file: "boardwalk.png", roles: ["background", "atmosphere"] },
      { file: "beach-light.png", roles: ["background"] },
    ])
    const input = draftToInput(draft) as { products: Array<{ referenceImages?: unknown }> }
    expect(input.products[0].referenceImages).toEqual(["citrus-can.png"])
    expect(input.products[1].referenceImages).toEqual([{ file: "boardwalk.png", roles: ["background", "atmosphere"] }, "beach-light.png"])
    expect(back.brief.brand?.colors).toEqual({ primary: "#0E7C86", secondary: "#F4F1EA" })
  })

  it("empty draft has issues and no brand", () => {
    const draft = emptyDraft()
    const v = validateDraft(draft)
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.issues.map((i) => i.path)).toContain("products[0].name")
    expect((draftToInput(draft) as { brand?: unknown }).brand).toBeUndefined()
  })
})

describe("misc", () => {
  it("slugifies", () => {
    expect(slugify("Summer Hydration 2026!")).toBe("summer-hydration-2026")
    expect(slugify("???")).toBe("item")
  })

  it("json schema includes alias and output fields", () => {
    const schema = briefJsonSchema() as { required?: string[]; properties?: Record<string, unknown> }
    expect(schema.required).toEqual(expect.arrayContaining(["products"]))
    expect(schema.properties).toHaveProperty("campaign")
    expect(schema.properties).toHaveProperty("aspectRatio")
    expect(schema.properties).toHaveProperty("logoPlacement")
  })
})
