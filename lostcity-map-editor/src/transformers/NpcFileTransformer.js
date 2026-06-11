// Parses a single .npc script file. Returns Map<string, object>.
export function parseNpcFile(text) {
  const npcMap = new Map()
  let cur = null
  let models = new Map()
  let recols = new Map()
  let name = null, desc = null
  let resizeh = 128, resizev = 128, size = 1

  const flush = () => {
    if (cur == null) return
    const d = { resizeh, resizev, size }
    if (models.size > 0) {
      const maxIdx = Math.max(...models.keys())
      const list = []
      for (let i = 1; i <= maxIdx; i++) {
        const m = models.get(i)
        if (m != null) list.push(m)
      }
      d.models = list
    }
    if (recols.size > 0) d.recols = new Map(recols)
    if (name != null) d.name = name
    if (desc != null) d.desc = desc
    npcMap.set(cur, d)
  }

  const reset = () => {
    models.clear(); recols.clear()
    name = null; desc = null
    resizeh = 128; resizev = 128; size = 1
  }

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
      case 'name':    name    = val;       break
      case 'desc':    desc    = val;       break
      case 'size':    size    = int(val);  break
      case 'resizeh': resizeh = int(val);  break
      case 'resizev': resizev = int(val);  break
      default: {
        const mm = key.match(/^model(\d+)$/)
        if (mm) { models.set(parseInt(mm[1], 10), val); break }
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
  return npcMap
}

export function mergeNpcMaps(maps) {
  const merged = new Map()
  for (const m of maps) for (const [k, v] of m) if (!merged.has(k)) merged.set(k, v)
  return merged
}
