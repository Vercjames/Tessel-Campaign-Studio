import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { renderIncludes } from "../scripts/sync-readme.mjs"

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
describe("README includes", () => {
  it("embeds the example brief verbatim", () => {
    const readme = readFileSync("README.md", "utf8")
    expect(renderIncludes(readme)).toBe(readme)
  })
})
