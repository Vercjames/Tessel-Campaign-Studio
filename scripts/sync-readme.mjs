import { readFileSync, writeFileSync } from "node:fs"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
// NOTE: Each include is a pair of HTML comments in README.md; the block between them is replaced with the file
const README = "README.md"
const INCLUDES = [{ marker: "example-brief", file: "public/examples/campaign-brief.yaml", lang: "yaml" }]

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
export function renderIncludes(readme, read = (f) => readFileSync(f, "utf8")) {
  // NOTE: The block takes the README's own line ending so an editor saving CRLF never leaves a mixed file
  const eol = readme.includes("\r\n") ? "\r\n" : "\n"
  let out = readme
  for (const { marker, file, lang } of INCLUDES) {
    const open = `<!-- include:${marker} -->`
    const close = `<!-- /include:${marker} -->`
    const start = out.indexOf(open)
    const end = out.indexOf(close)
    if (start === -1 || end === -1 || end < start) throw new Error(`README.md is missing the ${marker} include markers`)
    const body = read(file).replace(/\r\n/g, "\n").replace(/\s+$/, "").split("\n").join(eol)
    const block = [open, `\`\`\`${lang}`, body, "```", close].join(eol)
    out = out.slice(0, start) + block + out.slice(end + close.length)
  }
  return out
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
if (process.argv[1]?.endsWith("sync-readme.mjs")) {
  const check = process.argv.includes("--check")
  const current = readFileSync(README, "utf8")
  const next = renderIncludes(current)
  if (next === current) {
    console.log("README.md is in sync")
  } else if (check) {
    console.error("README.md is out of sync. Run: npm run readme:sync")
    process.exit(1)
  } else {
    writeFileSync(README, next)
    console.log("README.md updated")
  }
}
