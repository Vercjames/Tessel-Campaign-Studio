import type { NextConfig } from "next"

// Application Component || Define Configs
// =======================================================================================
// =======================================================================================
// NOTE: The asset library is read at runtime, so it must be traced into every serverless function bundle
const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/*": ["assets/**/*"] },
}

// Application Architecture || Define Exports
// =======================================================================================
// =======================================================================================
export default nextConfig
