import { checkLegal, describeLegalIssues } from "@utils/brief/legal"
import { parseBriefs } from "@utils/brief/parse"
import { describe, expect, it } from "vitest"

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function brief(overrides: Record<string, unknown> = {}) {
  const base = {
    campaign: "Summer Fitness",
    region: "Southwest US",
    audience: "Active adults",
    message: "Find out how to get started.",
    products: [
      { name: "Gym Towel", description: "A folded charcoal towel" },
      { name: "Water Bottle", description: "A matte black bottle" },
    ],
    ...overrides,
  }
  const result = parseBriefs(JSON.stringify(base), "b.json")
  if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result.issues)}`)
  return result.briefs[0]
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
describe("checkLegal", () => {
  it("passes a clean brief", () => {
    expect(checkLegal(brief())).toEqual([])
  })

  it("flags profanity in the message with its field", () => {
    const issues = checkLegal(brief({ message: "This shit works." }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ path: "message", label: "message", term: "shit", category: "profanity" })
  })

  it("flags product names and descriptions by product", () => {
    const issues = checkLegal(
      brief({
        products: [
          { name: "Damn Good Towel", description: "Fucking soft" },
          { name: "Bottle", description: "ok" },
        ],
      }),
    )
    expect(issues.map((i) => i.path)).toEqual(["products[0].name", "products[0].description"])
    expect(issues[0].label).toBe('product "Damn Good Towel" name')
    expect(issues[1].term).toBe("fucking")
  })

  it("checks campaign name, region, audience and avoid", () => {
    const issues = checkLegal(brief({ campaign: "Crap Sale", region: "Hell's Kitchen", audience: "Asses", avoid: "bullshit" }))
    expect(issues.map((i) => i.path).sort()).toEqual(["audience", "avoid", "name"].sort())
  })

  it("matches whole words only, ignoring case and accents", () => {
    expect(checkLegal(brief({ message: "Scunthorpe assets, a classy bassist" }))).toEqual([])
    expect(checkLegal(brief({ message: "SHÍT happens" }))[0]?.term).toBe("shit")
  })

  it("flags restricted claims", () => {
    const issues = checkLegal(brief({ message: "Guaranteed results, clinically proven" }))
    expect(issues.map((i) => i.term)).toEqual(["guaranteed", "clinically proven"])
    expect(issues[0].category).toBe("claim")
  })

  it("takes extra terms", () => {
    const issues = checkLegal(brief({ message: "Try Acme today" }), ["acme"])
    expect(issues[0]).toMatchObject({ term: "acme", category: "custom" })
  })

  it("describes issues for people", () => {
    const issues = checkLegal(
      brief({
        message: "shit",
        products: [
          { name: "Damn", description: "d" },
          { name: "B", description: "d" },
        ],
      }),
    )
    expect(describeLegalIssues(issues)).toBe('Prohibited word "shit" in message, "damn" in product "Damn" name')
  })
})
