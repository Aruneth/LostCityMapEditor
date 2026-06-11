// Parses a single .loc script file. Returns Map<string, object>.
// FileLoader (T05) calls this per file and merges results.
export function parseLocFile(text) {
  const locMap = new Map()
  let cur = null
  let props = {}
  const recols = new Map()
  const retexs = new Map()

  const flush = () => {
    if (cur == null) return
    const d = { ...props }
    if (recols.size > 0) d.recols = new Map(recols)
    if (retexs.size > 0) d.retexs = new Map(retexs)
    locMap.set(cur, d)
  }

  const resetProps = () => {
    props = {
      width: 1, length: 1, hillskew: false, sharelight: false, occlude: true,
      anim: 0, wallwidth: 16, ambient: 0, contrast: 0, animHasAlpha: false,
      mapfunction: 0, mirror: false, shadow: false,
      resizex: 128, resizey: 128, resizez: 128,
      offsetx: 0, offsety: 0, offsetz: 0,
      forcedecor: false, active: false, mapscene: 0,
    }
    recols.clear()
    retexs.clear()
  }

  resetProps()

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue

    const nameMatch = line.match(/^\[(.+?)\]$/)
    if (nameMatch) {
      flush()
      cur = nameMatch[1]
      resetProps()
      continue
    }

    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()

    const bool = v => v.toLowerCase() !== 'no' && v.toLowerCase() !== 'false'
    const int  = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n }

    switch (key) {
      case 'name': props.name = val; break
      case 'desc': props.desc = val; break
      case 'model': props.model = val; break
      case 'op1': props.op1 = val; break
      case 'op2': props.op2 = val; break
      case 'category': props.category = val; break
      case 'forceapproach': props.forceapproach = val; break
      case 'occlude':    props.occlude    = bool(val); break
      case 'active':     props.active     = val.toLowerCase() === 'yes'; break
      case 'hillskew':   props.hillskew   = val.toLowerCase() === 'yes'; break
      case 'sharelight': props.sharelight = val.toLowerCase() === 'yes'; break
      case 'mirror':     props.mirror     = val.toLowerCase() === 'yes'; break
      case 'shadow':     props.shadow     = val.toLowerCase() === 'yes'; break
      case 'forcedecor': props.forcedecor = val.toLowerCase() === 'yes'; break
      case 'blockrange': props.blockrange = !(val.toLowerCase() === 'yes'); break
      case 'width':      props.width      = int(val); break
      case 'length':     props.length     = int(val); break
      case 'wallwidth':  props.wallwidth   = int(val); break
      case 'ambient':    props.ambient     = int(val) & 0xFF; break  // byte
      case 'contrast':   props.contrast    = int(val) & 0xFF; break
      case 'resizex':    props.resizex     = int(val); break
      case 'resizey':    props.resizey     = int(val); break
      case 'resizez':    props.resizez     = int(val); break
      case 'offsetx':    props.offsetx     = int(val); break
      case 'offsety':    props.offsety     = int(val); break
      case 'offsetz':    props.offsetz     = int(val); break
      case 'mapfunction': props.mapfunction = int(val); break
      case 'mapscene':   props.mapscene    = int(val); break
      case 'anim':       props.anim        = int(val); break
      default: {
        // recol<n>s/d=<value>
        const rcm = key.match(/^recol(\d+)([sd])$/)
        if (rcm) {
          const idx = parseInt(rcm[1], 10)
          const type = rcm[2]
          const entry = recols.get(idx) ?? [0, 0]
          entry[type === 's' ? 0 : 1] = int(val)
          recols.set(idx, entry)
          break
        }
        // retex<n>s/d=<value>
        const rtm = key.match(/^retex(\d+)([sd])$/)
        if (rtm) {
          const idx = parseInt(rtm[1], 10)
          const type = rtm[2]
          const entry = retexs.get(idx) ?? [null, null]
          entry[type === 's' ? 0 : 1] = val
          retexs.set(idx, entry)
        }
      }
    }
  }
  flush()
  return locMap
}

// Merges multiple parsed loc maps. First occurrence wins.
export function mergeLocMaps(maps) {
  const merged = new Map()
  for (const m of maps) {
    for (const [k, v] of m) {
      if (!merged.has(k)) merged.set(k, v)
    }
  }
  return merged
}
