import { Toaster } from "@comps/ui/sonner"
import { TooltipProvider } from "@comps/ui/tooltip"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Tessel Campaign Studio",
  description: "Campaign images from a brief, rendered with Gemini.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  )
}
