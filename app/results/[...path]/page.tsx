import { Badge } from "@comps/ui/badge"
import { buttonVariants } from "@comps/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@comps/ui/card"
import { readOutputMeta } from "@utils/server/outputs"
import { ArrowLeft, Download, ExternalLink } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
export const dynamic = "force-dynamic"

// Application Architecture || Define Functions
// =======================================================================================
// =======================================================================================
function decodeSegments(path: string[]): string[] {
  return path.map((s) => decodeURIComponent(s))
}

function downloadName(meta: NonNullable<Awaited<ReturnType<typeof readOutputMeta>>>): string {
  const ext = meta.image.mimeType === "image/jpeg" ? "jpg" : meta.image.mimeType === "image/webp" ? "webp" : "png"
  return `${meta.campaignId}__${meta.locale}__${meta.aspectRatio.replace(":", "x")}.${ext}`
}

function Detail({ label, children }: IDetailProps) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

// Application Component || Define Exports
// =======================================================================================
// =======================================================================================
export async function generateMetadata({ params }: PageProps<"/results/[...path]">): Promise<Metadata> {
  const { path } = await params
  const meta = await readOutputMeta(decodeSegments(path))
  if (!meta) return { title: "Result not found · Tessel Campaign Studio" }
  return { title: `${meta.campaignName} · ${meta.locale} · ${meta.aspectRatio} · Tessel Campaign Studio` }
}

export default async function ResultPage({ params }: PageProps<"/results/[...path]">) {
  const { path } = await params
  const meta = await readOutputMeta(decodeSegments(path))
  if (!meta) notFound()

  const created = new Date(meta.createdAt)

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to studio
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.campaignName}</h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="font-mono uppercase">
              {meta.locale}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {meta.aspectRatio}
            </Badge>
            <Badge variant="outline">{meta.model}</Badge>
            {meta.masterJobId === null ? (
              <Badge variant="secondary">master image</Badge>
            ) : (
              <Badge variant="secondary">derived from master</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={meta.image.url} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ExternalLink data-icon="inline-start" />
            Open image
          </a>
          <a href={meta.image.url} download={downloadName(meta)} className={buttonVariants({ variant: "default", size: "sm" })}>
            <Download data-icon="inline-start" />
            Download
          </a>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <figure className="overflow-hidden rounded-xl border bg-muted/40">
          {/* biome-ignore lint/performance/noImgElement: generated at runtime */}
          <img
            src={meta.image.url}
            alt={`${meta.campaignName}, ${meta.locale}, ${meta.aspectRatio}`}
            className="mx-auto max-h-[82vh] w-full object-contain"
          />
        </figure>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Detail label="Message">{meta.headline ?? <span className="text-muted-foreground">none</span>}</Detail>
              <Detail label="Assets used">
                {meta.assetsUsed.length > 0 ? (
                  <ul className="space-y-0.5 font-mono text-xs">
                    {meta.assetsUsed.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">none</span>
                )}
              </Detail>
              {meta.assetsMissing.length > 0 ? (
                <Detail label="Missing assets">
                  <ul className="space-y-0.5 font-mono text-xs text-amber-600 dark:text-amber-400">
                    {meta.assetsMissing.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </Detail>
              ) : null}
              {meta.note ? <Detail label="Model note">{meta.note}</Detail> : null}
              <Detail label="Generated">
                <time dateTime={meta.createdAt}>{Number.isNaN(created.getTime()) ? meta.createdAt : created.toLocaleString()}</time>
              </Detail>
              <Detail label="File">
                <span className="font-mono text-xs">
                  {meta.image.relPath} · {(meta.image.size / 1024).toFixed(0)} KB
                </span>
              </Detail>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prompt sent</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {meta.prompt}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

// Application Component || Define Typologies
// =======================================================================================
// =======================================================================================
interface IDetailProps {
  label: string
  children: React.ReactNode
}
