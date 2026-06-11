// Parses a single .opt texture-options file.
// File format: a single CSV line: cropX,cropY,width,height
// Returns { cropX, cropY, width, height } or null.
export function parseOptFile(text) {
  const line = text.split('\n')[0]?.trim()
  if (!line) return null
  const parts = line.split(',').map(s => parseInt(s.trim(), 10))
  if (parts.length < 4 || parts.some(isNaN)) return null
  return { cropX: parts[0], cropY: parts[1], width: parts[2], height: parts[3] }
}
