// Parses .pack text files (format: "id=name" per line).
// The flo pack wraps names in [...] for use as keys in FloFileTransformer.

// Returns Map<number, string>. wrapBrackets wraps the name as "[name]".
export function parsePackFile(text, wrapBrackets = false) {
  const map = new Map()
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const id   = parseInt(line.slice(0, eq).trim(), 10)
    const name = line.slice(eq + 1).trim()
    if (isNaN(id)) continue
    map.set(id, wrapBrackets ? `[${name}]` : name)
  }
  return map
}

// Returns Map<string, number> — model name → id (reversed from other packs).
export function parseModelPack(text) {
  const map = new Map()
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const id   = parseInt(line.slice(0, eq).trim(), 10)
    const name = line.slice(eq + 1).trim()
    if (isNaN(id)) continue
    map.set(name, id)
  }
  return map
}
