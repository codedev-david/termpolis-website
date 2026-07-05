#!/usr/bin/env node
// Sync the marketing site's app-derived facts (release VERSION + MCP TOOL COUNT)
// to the LATEST PUBLISHED release of the Termpolis app, so the site tracks
// releases without a manual audit each time.
//
// Why this exists: the JSON-LD `softwareVersion` and the "N tools" claims are the
// two things that silently rot every release (softwareVersion sat at 1.16.7 for
// weeks; tool count lagged 25 -> 26 -> 31 across three same-day releases).
//
// Design guarantees:
//   * SOURCE OF TRUTH is the app's *published* release, never local files or HEAD.
//     (releases/latest excludes drafts/prereleases -> exactly what users download,
//      which also dissolves the release-race: the site never claims an unshipped
//      version/tool.)
//   * TARGETED, not prose-rewriting: every edit is a regex anchored to a unique,
//     unambiguous string. It touches numbers, never sentences.
//   * IDEMPOTENT: if the site already matches, it writes nothing (exit 0, no diff).
//   * FAIL-CLOSED: if the release or tool list can't be read, it throws and writes
//     nothing rather than guessing.
//   * HONEST about its limits: it keeps the NUMBERS correct but only WARNS (never
//     invents) when the tool-name lists or the docs tool-table rows need a human —
//     i.e. when a genuinely new tool ships and deserves real marketing copy.
//
// Usage:
//   node scripts/sync-app-facts.mjs           # patch files in place
//   node scripts/sync-app-facts.mjs --check   # report only, write nothing, exit 1 if drifted
//
// Env: APP_REPO (default codedev-david/termpolis), GITHUB_TOKEN (optional, lifts API rate limit).

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const APP_REPO = process.env.APP_REPO || 'codedev-david/termpolis'
const CHECK = process.argv.includes('--check')
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UA = 'termpolis-site-sync'

function apiHeaders() {
  const h = { accept: 'application/vnd.github+json', 'user-agent': UA }
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return h
}

async function fetchText(url, headers) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res
}

async function getAppFacts() {
  // 1) latest PUBLISHED release (draft + prerelease excluded by this endpoint)
  const rel = await (await fetchText(`https://api.github.com/repos/${APP_REPO}/releases/latest`, apiHeaders())).json()
  const tag = rel.tag_name
  if (!tag) throw new Error('releases/latest returned no tag_name')
  const version = tag.replace(/^v/, '')

  // 2) the tool set AS OF THAT TAG (not HEAD) — every tool object is
  //    `name: '...', description: ...`; the serverInfo `name: 'termpolis-mcp'`
  //    is followed by `version:`, not `description:`, so it is excluded.
  const src = await (await fetchText(`https://raw.githubusercontent.com/${APP_REPO}/${tag}/src/main/mcpServer.ts`, { 'user-agent': UA })).text()
  const names = [...src.matchAll(/name:\s*'([^']+)',\s*description:/g)].map((m) => m[1])
  if (names.length === 0) throw new Error('parsed 0 MCP tools from mcpServer.ts — refusing to write')

  const cat = {
    swarm: names.filter((n) => n.startsWith('swarm_')).length,
    memory: names.filter((n) => n.startsWith('memory_')).length,
    code: names.filter((n) => n.startsWith('code_')).length,
  }
  cat.terminal = names.length - cat.swarm - cat.memory - cat.code
  return { version, tag, total: names.length, names, cat }
}

// Adjust the trailing spaces of the ASCII-diagram line so the box stays aligned
// even if the tool count changes digit-width (e.g. 99 -> 100).
function patchAsciiCount(content, total) {
  return content.replace(
    /(│  ├── MCP server \(HTTP, )(\d+)( tools\))( *)(│)/,
    (_m, pre, oldN, mid, spaces, bar) => {
      const delta = String(total).length - oldN.length
      const pad = delta > 0 ? spaces.slice(0, Math.max(0, spaces.length - delta)) : spaces + ' '.repeat(-delta)
      return `${pre}${total}${mid}${pad}${bar}`
    },
  )
}

function countList(content, re) {
  const m = content.match(re)
  if (!m) return null
  return m[1].split(',').map((s) => s.trim()).filter(Boolean).length
}

async function main() {
  const f = await getAppFacts()
  console.log(
    `App (published): v${f.version} · ${f.total} MCP tools ` +
      `(${f.cat.terminal} terminal/project + ${f.cat.swarm} swarm + ${f.cat.memory} memory + ${f.cat.code} code-graph)`,
  )

  const files = {
    'index.html': [
      [/("softwareVersion":\s*")\d+\.\d+\.\d+(")/, `$1${f.version}$2`],
      [/(localhost:9315 with )\d+( tools)/g, `$1${f.total}$2`],
      [/(<h3>)\d+( MCP tools<\/h3>)/, `$1${f.total}$2`],
      [/(\+ )\d+( swarm coordination tools)/, `$1${f.cat.swarm}$2`],
      [/(\+ )\d+( memory\/learning tools)/, `$1${f.cat.memory}$2`],
      [/(\+ )\d+( code-graph tools)/, `$1${f.cat.code}$2`],
    ],
    'docs.html': [
      [/(<h3>The )\d+( tools an agent can call<\/h3>)/, `$1${f.total}$2`],
    ],
  }

  const changed = []
  const warnings = []

  for (const [name, rules] of Object.entries(files)) {
    const path = join(ROOT, name)
    const before = readFileSync(path, 'utf8')
    let after = before
    for (const [re, rep] of rules) after = after.replace(re, rep)
    if (name === 'docs.html') after = patchAsciiCount(after, f.total)

    if (after !== before) {
      changed.push(name)
      if (!CHECK) writeFileSync(path, after)
    }

    // Consistency checks (warn only — a new tool needs human marketing copy).
    if (name === 'index.html') {
      const mem = countList(after, /\d+ memory\/learning tools \(([^)]+)\)/)
      const code = countList(after, /\d+ code-graph tools \(([^)]+)\)/)
      if (mem !== null && mem !== f.cat.memory)
        warnings.push(`index.html memory tool-name list has ${mem} names but the count is now ${f.cat.memory} — add/remove the name(s).`)
      if (code !== null && code !== f.cat.code)
        warnings.push(`index.html code-graph tool-name list has ${code} names but the count is now ${f.cat.code} — add/remove the name(s).`)
    }
    if (name === 'docs.html') {
      const rows = (after.match(/<tr><td><code>(?:list_|create_|run_|read_|close_|get_|write_|swarm_|memory_|code_)/g) || []).length
      if (rows !== f.total)
        warnings.push(`docs.html tool table has ${rows} tool rows but the release has ${f.total} — add the missing row(s) with descriptions.`)
    }
  }

  for (const w of warnings) console.log(`::warning::${w}`)

  // Emit outputs for the workflow (version for the commit message, changed for the deploy gate).
  if (process.env.GITHUB_OUTPUT) {
    const out = [`version=${f.version}`, `total=${f.total}`, `changed=${changed.length > 0}`].join('\n') + '\n'
    writeFileSync(process.env.GITHUB_OUTPUT, out, { flag: 'a' })
  }

  if (changed.length === 0) {
    console.log('In sync — no changes.')
    return
  }
  console.log(`${CHECK ? 'DRIFT (check only, not written)' : 'Updated'}: ${changed.join(', ')}`)
  if (CHECK) process.exitCode = 1
}

main().catch((err) => {
  console.error(`::error::sync-app-facts failed: ${err.message}`)
  process.exit(2)
})
