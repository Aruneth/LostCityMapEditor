// Parses .flo floor-texture definition files.
// Returns { underlays: Map<"[name]", rgb>, overlays: Map<"[name]", {rgb?, texture?, occlude}> }

export function parseFloFile(text) {
  const underlays = new Map()
  const overlays  = new Map()

  let currentName = null
  let rgb         = null
  let texture     = null
  let occlude     = null
  let isOverlay   = null

  const flush = () => {
    if (currentName == null) return
    if (isOverlay === true) {
      const data = { occlude: occlude == null ? true : occlude }
      if (rgb     != null) data.rgb     = rgb
      if (texture != null) data.texture = texture
      overlays.set(currentName, data)
    } else if (rgb != null) {
      underlays.set(currentName, rgb)
    }
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue

    const nameMatch = line.match(/\[(.*?)\]/)
    if (nameMatch) {
      flush()
      currentName = `[${nameMatch[1]}]`
      rgb = null; texture = null; occlude = null; isOverlay = null
    } else if (line.startsWith('rgb=') || line.startsWith('colour=')) {
      const hex = line.slice(line.indexOf('=') + 1).trim().replace('0x', '')
      const parsed = parseInt(hex, 16)
      if (!isNaN(parsed)) rgb = parsed
    } else if (line.startsWith('texture=')) {
      texture = line.slice(8).trim()
    } else if (line.startsWith('occlude=')) {
      occlude = line.slice(8).trim().toLowerCase() !== 'no'
    } else if (line.startsWith('overlay=')) {
      isOverlay = line.slice(8).trim().toLowerCase() === 'yes'
    }
  }
  flush()

  return { underlays, overlays }
}

// Merges results from multiple .flo files. First occurrence wins (matches Java).
export function mergeFloData(floResults) {
  const underlays = new Map()
  const overlays  = new Map()
  for (const { underlays: u, overlays: o } of floResults) {
    for (const [k, v] of u) if (!underlays.has(k)) underlays.set(k, v)
    for (const [k, v] of o) if (!overlays.has(k))  overlays.set(k, v)
  }
  return { underlays, overlays }
}
