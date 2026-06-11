import { assetStore }          from './AssetStore.js'
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
