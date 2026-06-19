import { assetStore }              from './AssetStore.js'
import { parseJM2, serializeJM2 } from '../transformers/MapDataTransformer.js'

const api = () => window.electronAPI

// Returns a sorted array of .jm2 filenames from the server's maps/ directory.
export async function listMaps() {
  const mapsDir = `${assetStore.serverDir}/maps`
  let entries
  try {
    entries = await api().readDir(mapsDir)
  } catch {
    console.error('Could not read maps directory:', mapsDir)
    return []
  }
  return entries
    .filter(name => name.toLowerCase().endsWith('.jm2'))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

// Loads and parses a single JM2 map file. fileName is just the filename (no path).
export async function loadMap(fileName) {
  const filePath = `${assetStore.serverDir}/maps/${fileName}`
  const buf  = await api().readFile(filePath)
  const text = new TextDecoder().decode(new Uint8Array(buf))
  return parseJM2(text, filePath)
}

// Loads an N×N grid of regions centred on centerName.
// radius 0=1×1, 1=3×3, 2=5×5, 3=7×7, 4=9×9.
// Returns { regions: [{mapData, originX, originZ, name, isPrimary}] }
// originX/Z are tile offsets so the grid starts at (0,0) and the primary is at (radius*64, radius*64).
export async function loadMapGrid(centerName, radius = 1) {
  const m = centerName.match(/^m(\d+)_(\d+)\.jm2$/i)
  if (!m || radius === 0) {
    const mapData = await loadMap(centerName)
    return { regions: [{ mapData, originX: 0, originZ: 0, name: centerName, isPrimary: true }] }
  }

  const cx = parseInt(m[1], 10)
  const cz = parseInt(m[2], 10)

  const tasks = []
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      tasks.push({
        name:      `m${cx + dx}_${cz + dz}.jm2`,
        originX:   (dx + radius) * 64,
        originZ:   (dz + radius) * 64,
        isPrimary: dx === 0 && dz === 0,
      })
    }
  }

  const regions = (await Promise.all(
    tasks.map(async t => {
      try   { return { ...t, mapData: await loadMap(t.name) } }
      catch { return null }
    })
  )).filter(Boolean)

  return { regions }
}

// Saves MapData back to the maps/ directory as a JM2 file.
export async function saveMap(mapData, fileName) {
  const filePath = `${assetStore.serverDir}/maps/${fileName}`
  const text = serializeJM2(mapData)
  await api().writeFile(filePath, text)
}

// Opens a save-as dialog and exports to a user-chosen path.
export async function exportMapAs(mapData, defaultFileName) {
  const result = await api().showSaveDialog({
    title: 'Export Map',
    defaultPath: `${assetStore.serverDir}/maps/${defaultFileName}`,
    filters: [{ name: 'JM2 Files', extensions: ['jm2'] }],
  })
  if (result.canceled || !result.filePath) return false
  const text = serializeJM2(mapData)
  await api().writeFile(result.filePath, text)
  return true
}
