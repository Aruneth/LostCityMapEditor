// Parses a single .obj script file. Returns Map<string, object>.
export function parseObjFile(text) {
  const objMap = new Map()
  let cur = null
  let model = null, name = null, desc = null
  let recols = new Map()

  const flush = () => {
    if (cur == null) return
    const d = { model }
    if (recols.size > 0) d.recols = new Map(recols)
    if (name != null) d.name = name
    if (desc != null) d.desc = desc
    objMap.set(cur, d)
  }

  const reset = () => { model = null; name = null; desc = null; recols.clear() }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue

    const nameMatch = line.match(/^\[(.+?)\]$/)
    if (nameMatch) { flush(); cur = nameMatch[1]; reset(); continue }

    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    const int = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n }

    switch (key) {
      case 'name':  name  = val; break
      case 'desc':  desc  = val; break
      case 'model': model = val; break
      default: {
        const rcm = key.match(/^recol(\d+)([sd])$/)
        if (rcm) {
          const idx = parseInt(rcm[1], 10)
          const entry = recols.get(idx) ?? [0, 0]
          entry[rcm[2] === 's' ? 0 : 1] = int(val)
          recols.set(idx, entry)
        }
      }
    }
  }
  flush()
  return objMap
}

export function mergeObjMaps(maps) {
  const merged = new Map()
  for (const m of maps) for (const [k, v] of m) if (!merged.has(k)) merged.set(k, v)
  return merged
}
