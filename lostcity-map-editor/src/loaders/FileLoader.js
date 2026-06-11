import { assetStore }               from './AssetStore.js'
import { parsePackFile, parseModelPack } from '../transformers/PackFileTransformer.js'
import { parseFloFile, mergeFloData }    from '../transformers/FloFileTransformer.js'
import { parseLocFile, mergeLocMaps }    from '../transformers/LocFileTransformer.js'
import { parseNpcFile, mergeNpcMaps }    from '../transformers/NpcFileTransformer.js'
import { parseObjFile, mergeObjMaps }    from '../transformers/ObjFileTransformer.js'
import { parseOptFile }                  from '../transformers/OptFileTransformer.js'
import { parseOb2 }                      from '../transformers/Ob2FileTransformer.js'

// Shape suffix map — mirrors World.SHAPE_SUFFIX_MAP in Java.
const SHAPE_SUFFIX_MAP = new Map([
  [0,'_1'],[1,'_2'],[2,'_3'],[3,'_4'],[4,'_q'],[5,'_w'],[6,'_r'],[7,'_e'],
  [8,'_t'],[9,'_5'],[10,'_8'],[11,'_9'],[12,'_a'],[13,'_s'],[14,'_d'],[15,'_f'],
  [16,'_g'],[17,'_h'],[18,'_z'],[19,'_x'],[20,'_c'],[21,'_v'],[22,'_0'],
])

const api = () => window.electronAPI

// Read a file and return its content as a string.
async function readText(filePath) {
  const buf = await api().readFile(filePath)
  return new TextDecoder().decode(new Uint8Array(buf))
}

// Read a file and return an ArrayBuffer (for binary files like .ob2).
async function readBinary(filePath) {
  return api().readFile(filePath)
}

// Emit a progress event so the UI can show a loading indicator (T11).
function progress(message) {
  window.dispatchEvent(new CustomEvent('loader:progress', { detail: message }))
  console.log('[FileLoader]', message)
}

// Main entry point — loads all server assets from the given directory.
// Returns the populated assetStore singleton.
export async function loadFiles(dirPath) {
  assetStore.serverDir = dirPath

  // 1. Pack files (flat text, small — load in parallel)
  progress('Loading pack files...')
  const [floPackText, texPackText, locPackText, npcPackText, objPackText, modelPackText] =
    await Promise.all([
      readText(`${dirPath}/pack/flo.pack`),
      readText(`${dirPath}/pack/texture.pack`),
      readText(`${dirPath}/pack/loc.pack`),
      readText(`${dirPath}/pack/npc.pack`),
      readText(`${dirPath}/pack/obj.pack`),
      readText(`${dirPath}/pack/model.pack`),
    ])

  assetStore.floPackMap     = parsePackFile(floPackText, true)   // wraps names in [...]
  assetStore.texturePackMap = parsePackFile(texPackText)
  assetStore.locPackMap     = parsePackFile(locPackText)
  assetStore.npcPackMap     = parsePackFile(npcPackText)
  assetStore.objPackMap     = parsePackFile(objPackText)
  assetStore.modelPackMap   = parseModelPack(modelPackText)

  // 2. FLO files — scan server dir recursively for *.flo
  progress('Loading floor textures (.flo)...')
  const floPaths = await api().walkDir(dirPath, '.flo')
  const floResults = await Promise.all(
    floPaths.map(p => readText(p).then(t => parseFloFile(t)))
  )
  const { underlays, overlays } = mergeFloData(floResults)
  assetStore.underlayMap = underlays
  assetStore.overlayMap  = overlays

  // 3. OPT texture options — textures/meta/*.opt
  progress('Loading texture options (.opt)...')
  const optPaths = await api().walkDir(`${dirPath}/textures/meta`, '.opt')
  for (const p of optPaths) {
    const name = p.replace(/\\/g, '/').split('/').pop().replace(/\.opt$/i, '')
    const text = await readText(p)
    const opts = parseOptFile(text)
    if (opts) assetStore.textureOptsMap.set(name, opts)
  }

  // 4. Script files — loc, npc, obj from scripts/ subdirectory
  progress('Loading loc scripts (.loc)...')
  const locPaths = await api().walkDir(`${dirPath}/scripts`, '.loc')
  const locMaps  = await Promise.all(locPaths.map(p => readText(p).then(t => parseLocFile(t))))
  assetStore.allLocMap = mergeLocMaps(locMaps)

  progress('Loading npc scripts (.npc)...')
  const npcPaths = await api().walkDir(`${dirPath}/scripts`, '.npc')
  const npcMaps  = await Promise.all(npcPaths.map(p => readText(p).then(t => parseNpcFile(t))))
  assetStore.allNpcMap = mergeNpcMaps(npcMaps)

  progress('Loading obj scripts (.obj)...')
  const objPaths = await api().walkDir(`${dirPath}/scripts`, '.obj')
  const objMaps  = await Promise.all(objPaths.map(p => readText(p).then(t => parseObjFile(t))))
  assetStore.allObjMap = mergeObjMaps(objMaps)

  // 5. OB2 models — models/*.ob2, cross-referenced with modelPackMap
  progress('Loading 3D models (.ob2)...')
  const ob2Paths = await api().walkDir(`${dirPath}/models`, '.ob2')
  await Promise.all(ob2Paths.map(async p => {
    const name = p.replace(/\\/g, '/').split('/').pop().replace(/\.ob2$/i, '')
    if (!assetStore.modelPackMap.has(name)) return
    try {
      const buf = await readBinary(p)
      assetStore.modelOb2Map.set(assetStore.modelPackMap.get(name), parseOb2(buf))
    } catch (e) {
      console.warn('Failed to load model:', name, e)
    }
  }))

  progress(`Done — ${assetStore.modelOb2Map.size} models, ${assetStore.allLocMap.size} locs loaded.`)
  return assetStore
}

// Returns an array of viable loc shape IDs for a given script name.
// Mirrors FileLoader.getViableShapesForLoc() in Java.
export function getViableShapesForLoc(scriptName) {
  const scriptData = assetStore.allLocMap.get(scriptName)
  const modelBaseName = scriptData?.model ?? scriptName
  const shapes = []
  for (const [shapeId, suffix] of SHAPE_SUFFIX_MAP) {
    if (assetStore.modelPackMap.has(modelBaseName + suffix)) {
      shapes.push(shapeId)
    }
  }
  if (shapes.length === 0 && assetStore.modelPackMap.has(modelBaseName)) {
    shapes.push(10)
  }
  return shapes
}

// Prompt the user to pick a server directory and load all assets.
// Returns the populated assetStore or null if cancelled.
export async function chooseAndLoad() {
  const result = await api().showOpenDialog({
    title: 'Select Server Directory',
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths.length) return null
  return loadFiles(result.filePaths[0])
}
