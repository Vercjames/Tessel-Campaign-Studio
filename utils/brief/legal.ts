import type { TCampaignBrief } from "@utils/brief/schema"

// Application Architecture || Define Vars
// =======================================================================================
// =======================================================================================
// NOTE: Whole-word matches after lowercasing and stripping accents; common suffixes are covered by the matcher
// ↪ HOWEVER: This is a blocklist, not a classifier, so spaced-out or misspelt words pass through
const PROFANITY = [
  "arse",
  "arsehole",
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bollocks",
  "bugger",
  "bullshit",
  "cock",
  "crap",
  "cunt",
  "damn",
  "dick",
  "dickhead",
  "douche",
  "douchebag",
  "fag",
  "faggot",
  "fuck",
  "fucker",
  "fucking",
  "goddamn",
  "jackass",
  "jerkoff",
  "motherfucker",
  "nigga",
  "nigger",
  "piss",
  "prick",
  "pussy",
  "retard",
  "shit",
  "shite",
  "slut",
  "twat",
  "wanker",
  "whore",
]

// NOTE: Unsubstantiated or regulated marketing claims that legal review would strike from campaign copy
const CLAIMS = ["guaranteed", "guarantee", "cure", "cures", "risk-free", "clinically proven", "fda approved", "doctor recommended", "#1"]

const CATEGORIES: Array<{ category: TLegalCategory; terms: string[] }> = [
  { category: "profanity", terms: PROFANITY },
  { category: "claim", terms: CLAIMS },
]

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// NOTE: Word boundaries plus plural, past and agent suffixes so "damned" and "shits" trip the same term
function termPattern(term: string): RegExp {
  const body = escapeRegex(normalize(term)).replace(/\s+/g, "\\s+")
  return new RegExp(`(?<![a-z0-9])${body}(?:s|es|ed|er|ers|ing)?(?![a-z0-9])`, "i")
}

function findTerms(
  text: string,
  lists: Array<{ category: TLegalCategory; terms: string[] }>,
): Array<{ term: string; category: TLegalCategory }> {
  const haystack = normalize(text)
  const hits: Array<{ term: string; category: TLegalCategory; index: number }> = []
  for (const { category, terms } of lists) {
    for (const term of terms) {
      const match = termPattern(term).exec(haystack)
      if (match) hits.push({ term, category, index: match.index })
    }
  }
  // NOTE: One hit per field, reported in reading order, so "asshole" is not also reported as "ass"
  hits.sort((a, b) => a.index - b.index || b.term.length - a.term.length)
  const out: Array<{ term: string; category: TLegalCategory }> = []
  let lastEnd = -1
  for (const hit of hits) {
    if (hit.index < lastEnd) continue
    out.push({ term: hit.term, category: hit.category })
    lastEnd = hit.index + hit.term.length
  }
  return out
}

function fields(brief: TCampaignBrief): Array<{ path: string; label: string; text: string | undefined }> {
  const top = [
    { path: "name", label: "campaign name", text: brief.name },
    { path: "region", label: "region", text: brief.region },
    { path: "audience", label: "audience", text: brief.audience },
    { path: "message", label: "message", text: brief.message },
    { path: "avoid", label: "avoid", text: brief.avoid },
  ]
  const products = brief.products.flatMap((p, i) => [
    { path: `products[${i}].name`, label: `product "${p.name}" name`, text: p.name },
    { path: `products[${i}].description`, label: `product "${p.name}" description`, text: p.description },
  ])
  return [...top, ...products]
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
// NOTE: Every free-text field of the brief is checked; the first hit per field is reported with its path
export function checkLegal(brief: TCampaignBrief, extraTerms: string[] = []): ILegalIssue[] {
  const custom = extraTerms.map((t) => t.trim()).filter(Boolean)
  const lists = custom.length > 0 ? [...CATEGORIES, { category: "custom" as const, terms: custom }] : CATEGORIES
  const issues: ILegalIssue[] = []
  for (const field of fields(brief)) {
    if (!field.text) continue
    for (const hit of findTerms(field.text, lists)) {
      issues.push({ path: field.path, label: field.label, term: hit.term, category: hit.category })
    }
  }
  return issues
}

export function describeLegalIssues(issues: ILegalIssue[]): string {
  if (issues.length === 0) return ""
  const parts = issues.map((i) => `"${i.term}" in ${i.label}`)
  return `Prohibited word ${parts.join(", ")}`
}

// NOTE: Comma-separated words from the environment extend the built-in lists without a code change
export function extraLegalTerms(env: string | undefined): string[] {
  return (env ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
export type TLegalCategory = "profanity" | "claim" | "custom"

export interface ILegalIssue {
  path: string
  label: string
  term: string
  category: TLegalCategory
}
