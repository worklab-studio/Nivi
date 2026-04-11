import * as fs from 'fs'
import * as path from 'path'

// Workaround: Next.js 16 Turbopack sometimes fails to load certain env vars.
// We manually parse .env.local as a fallback.
let envCache: Record<string, string> | null = null

function loadEnvFallback(): Record<string, string> {
  if (envCache) return envCache
  envCache = {}

  try {
    const envPath = path.join(process.cwd(), '.env.local')
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex)
      let value = trimmed.slice(eqIndex + 1)
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      envCache[key] = value
    }
  } catch {
    // fallback failed
  }

  return envCache
}

export function getEnv(key: string): string {
  const value = process.env[key]
  if (value) return value

  // Fallback to manual parsing
  const fallback = loadEnvFallback()
  return fallback[key] ?? ''
}
