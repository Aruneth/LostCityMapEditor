import { Renderer }              from './renderer/Renderer.js'
import { ShaderManager }         from './renderer/ShaderManager.js'
import { Camera }                from './renderer/Camera.js'
import { MousePicker }           from './renderer/MousePicker.js'
import { ModelViewer }           from './renderer/ModelViewer.js'
import { resolveEntityModelId, worldBuilder } from './renderer/WorldBuilder.js'
import { MiniMap }               from './ui/MiniMap.js'
import { Sidebar }               from './ui/Sidebar.js'
import { TileInspector }         from './ui/TileInspector.js'
import { EntityInspector }       from './ui/EntityInspector.js'
import { TilePanel }             from './ui/TilePanel.js'
import { LocPanel }              from './ui/LocPanel.js'
import { NpcPanel }              from './ui/NpcPanel.js'
import { ObjPanel }              from './ui/ObjPanel.js'
import { assetStore }            from './loaders/AssetStore.js'
import { LocData }               from './data/LocData.js'
import { NpcData }               from './data/NpcData.js'
import { ObjData }               from './data/ObjData.js'
import { OverlayData }           from './data/OverlayData.js'
import { UnderlayData }          from './data/UnderlayData.js'
import { Clipboard }             from './editor/Clipboard.js'
import { UndoStack }             from './editor/UndoStack.js'

// Tab switching for left sidebar
document.querySelectorAll('#tab-bar .tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab
    document.querySelectorAll('#tab-bar .tab').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    const panel = tab === 'map' ? document.getElementById('sidebar-content')
                                : document.getElementById(`tab-panel-${tab}`)
    if (panel) panel.classList.add('active')
    // Cancel any active add/move/paint mode when leaving a tab
    tilePanel.exitPaintMode()
    locPanel.exitMoveMode(); locPanel.exitAddMode()
    npcPanel.exitMoveMode(); npcPanel.exitAddMode()
    objPanel.exitMoveMode(); objPanel.exitAddMode()
  })
})

const canvas   = document.getElementById('glCanvas')
const renderer = new Renderer(canvas)

// Compile shaders immediately — GL context is ready at construction time.
const shaderManager = new ShaderManager()
try {
  shaderManager.createProgram(renderer.gl)
  renderer.attach('shaderManager', shaderManager)
  console.log('Shaders compiled OK')
} catch (e) {
  console.error('Shader compilation failed:', e)
}

const camera = new Camera()
renderer.attach('camera', camera)

const mousePicker = new MousePicker()
renderer.attach('mousePicker', mousePicker)

renderer.start()

// Expose renderer globally so later modules (T12–T16, etc.) can attach.
window._renderer = renderer

const clipboard  = new Clipboard()
const undoStack  = new UndoStack()

// --- Model preview (T10) ---

const modelViewer = new ModelViewer(document.getElementById('modelPreviewCanvas'))

// --- UI ---

const sidebar = new Sidebar(renderer)

// Load a map when the world map window double-clicks a region.
window.electronAPI?.onLoadMap?.(name => sidebar.loadMap(name))

// Right sidebar: TileInspector + EntityInspector, wired to renderer events.
const tileMount   = document.getElementById('tile-inspector-mount')
const entityMount = document.getElementById('entity-inspector-mount')

const tileInspector = new TileInspector(tileMount, (tile, values) => {
  const { mapData } = renderer.scene
  if (!mapData) return
  undoStack.save(mapData)

  tile.height   = values.height
  tile.shape    = values.shape
  tile.rotation = values.rotation
  tile.flag     = values.flag

  if (values.underlayId >= 0) {
    if (!tile.underlay) tile.underlay = new UnderlayData()
    tile.underlay.id = values.underlayId
  } else {
    tile.underlay = null
  }

  if (values.overlayId >= 0) {
    if (!tile.overlay) tile.overlay = new OverlayData(values.overlayId)
    tile.overlay.id = values.overlayId
  } else {
    tile.overlay = null
  }

  window.dispatchEvent(new CustomEvent('editor:tileChanged', { detail: tile }))
})

window.addEventListener('editor:tileChanged', () => {
  sidebar.rebuildScene()
})

window.addEventListener('map:loaded', e => {
  const px = e.detail?.primaryOriginX ?? 0
  const pz = e.detail?.primaryOriginZ ?? 0
  camera.position[0] = (px + 32) * 128
  camera.position[2] = (pz + 32) * 128
  tilePanel.refresh(assetStore, worldBuilder.floTypes)
  tilePanel.showTile(null)
  locPanel.refresh(renderer.scene.mapData, assetStore)
  npcPanel.refresh(renderer.scene.mapData, assetStore)
  objPanel.refresh(renderer.scene.mapData, assetStore)
})

// Entity placement: ID of the last inspected entity per type, used as default for new placements.
let lastLocId = 0
let lastNpcId = 0
let lastObjId = 0

window.addEventListener('editor:entityChanged', () => {
  sidebar.rebuildScene()
  locPanel.refresh(renderer.scene.mapData, assetStore)
  npcPanel.refresh(renderer.scene.mapData, assetStore)
  objPanel.refresh(renderer.scene.mapData, assetStore)
})

window.addEventListener('locpanel:apply', e => {
  const { loc, x, z, level, shape, rotation } = e.detail
  const { mapData } = renderer.scene
  if (!mapData) return
  undoStack.save(mapData)
  loc.x = x; loc.z = z; loc.level = level; loc.shape = shape; loc.rotation = rotation
  locPanel.refresh(mapData, assetStore)
  sidebar.rebuildScene()
})

window.addEventListener('npcpanel:move', e => {
  const { npc, x, z, level } = e.detail
  const { mapData } = renderer.scene
  if (!mapData) return
  undoStack.save(mapData)
  npc.x = x; npc.z = z; npc.level = level
  npcPanel.refresh(mapData, assetStore)
  sidebar.rebuildScene()
})

window.addEventListener('objpanel:move', e => {
  const { obj, x, z, level, count } = e.detail
  const { mapData } = renderer.scene
  if (!mapData) return
  undoStack.save(mapData)
  obj.x = x; obj.z = z; obj.level = level; obj.count = count
  objPanel.refresh(mapData, assetStore)
  sidebar.rebuildScene()
})

window.addEventListener('editor:entityRemoved', (e) => {
  const { type, entity } = e.detail
  const { mapData: primary, regions } = renderer.scene
  if (!primary) return
  // Find the region that owns this entity and remove it there.
  const ownerRegion = regions
    ? regions.find(r => {
        if (type === 'loc') return r.mapData?.locations?.includes(entity)
        if (type === 'npc') return r.mapData?.npcs?.includes(entity)
        if (type === 'obj') return r.mapData?.objects?.includes(entity)
        return false
      })
    : null
  const target = ownerRegion?.mapData ?? primary
  if (ownerRegion?.isPrimary ?? true) undoStack.save(primary)
  if (type === 'loc') target.locations = target.locations.filter(l => l !== entity)
  else if (type === 'npc') target.npcs = target.npcs.filter(n => n !== entity)
  else if (type === 'obj') target.objects = target.objects.filter(o => o !== entity)
  entityInspector.show(null, null)
  modelViewer.clear()
  if (type === 'loc') locPanel.refresh(primary, assetStore)
  if (type === 'npc') npcPanel.refresh(primary, assetStore)
  if (type === 'obj') objPanel.refresh(primary, assetStore)
  sidebar.rebuildScene()
})

// Ctrl+C / Ctrl+V — skip when focus is inside a form field.
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
  const { mapData } = renderer.scene

  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    const tile = tileInspector.tile
    if (!tile || !mapData) return
    e.preventDefault()
    const locs = mapData.locations.filter(l => l.x === tile.x && l.z === tile.z && l.level === tile.level)
    const npcs = mapData.npcs.filter(n => n.x === tile.x && n.z === tile.z && n.level === tile.level)
    const objs = mapData.objects.filter(o => o.x === tile.x && o.z === tile.z && o.level === tile.level)
    clipboard.copy(tile, locs, npcs, objs)
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'v') {
    if (!clipboard.hasCopy() || !mapData) return
    e.preventDefault()
    const hovered = renderer.scene.hoveredTile
    if (!hovered) return
    const hitV = resolveWorldTile(hovered.x, hovered.z)
    if (!hitV?.isPrimary) return
    undoStack.save(mapData)
    const pasted = clipboard.paste(hitV.localX, hitV.localZ, sidebar.editLevel, mapData)
    if (pasted) sidebar.rebuildScene()
  }

  if (e.key === 'F2') {
    window.electronAPI?.openWorldMap?.()
    return
  }

  if (e.key === 'Escape') {
    tilePanel.exitPaintMode()
    locPanel.exitMoveMode(); locPanel.exitAddMode()
    npcPanel.exitMoveMode(); npcPanel.exitAddMode()
    objPanel.exitMoveMode(); objPanel.exitAddMode()
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    if (!undoStack.canUndo()) return
    e.preventDefault()
    const restored = undoStack.undo()
    renderer.scene.mapData = restored
    tileInspector.show(null)
    entityInspector.show(null, null)
    modelViewer.clear()
    sidebar.rebuildScene()
  }
})

const tilePanel = new TilePanel(document.getElementById('tab-panel-tiles'))
const locPanel = new LocPanel(document.getElementById('tab-panel-locs'))
const npcPanel = new NpcPanel(document.getElementById('tab-panel-npcs'))
const objPanel = new ObjPanel(document.getElementById('tab-panel-objs'))

const entityInspector = new EntityInspector(entityMount, (type, entity) => {
  // T14: Remove entity — dispatched so T14 wiring can handle undo + rebuild.
  window.dispatchEvent(new CustomEvent('editor:entityRemoved', { detail: { type, entity } }))
})

// Resolve a world tile coord (after origin offset) back to region + local coords.
function resolveWorldTile(worldX, worldZ) {
  const regions = renderer.scene.regions
  if (!regions) return { mapData: renderer.scene.mapData, localX: worldX, localZ: worldZ, isPrimary: true }
  for (const r of regions) {
    if (worldX >= r.originX && worldX < r.originX + 64 &&
        worldZ >= r.originZ && worldZ < r.originZ + 64) {
      return { mapData: r.mapData, localX: worldX - r.originX, localZ: worldZ - r.originZ, isPrimary: !!r.isPrimary }
    }
  }
  return null
}

// Left-click: place entity (L/N/O), apply tile (Ctrl), or inspect (plain).
renderer.onLeftClick = (keysHeld, hoveredTile) => {
  if (!hoveredTile || !renderer.scene.mapData) return
  const { x, z }     = hoveredTile   // world tile coords (after origin offset)
  const editLevel     = sidebar.editLevel
  const inspectLevel  = hoveredTile.level ?? editLevel

  const hit = resolveWorldTile(x, z)
  if (!hit) return
  const { mapData, localX, localZ, isPrimary } = hit
  const tile = mapData?.mapTiles[inspectLevel]?.[localX]?.[localZ]

  // Primary mapData is the one we edit and save.
  const primaryMapData = renderer.scene.mapData

  // TilePanel floor paint mode: replace underlay or overlay on the clicked tile.
  if (tilePanel.paintMode) {
    const t = mapData?.mapTiles[editLevel]?.[localX]?.[localZ]
    if (!t) return
    if (isPrimary) undoStack.save(primaryMapData)
    if (tilePanel.paintType === 'underlay') {
      if (!t.underlay) t.underlay = new UnderlayData(0)
      t.underlay.id = tilePanel.selectedPackId + 1   // underlay IDs are 1-indexed
    } else {
      if (!t.overlay) t.overlay = new OverlayData(0)
      t.overlay.id = tilePanel.selectedPackId         // overlay IDs are 0-indexed
      t.shape      = tilePanel.paintShape
      t.rotation   = tilePanel.paintRotation
    }
    sidebar.rebuildScene()
    return
  }

  // TilePanel height paint mode: set height on the clicked tile.
  if (tilePanel.heightPaintMode) {
    const t = mapData?.mapTiles[editLevel]?.[localX]?.[localZ]
    if (!t) return
    if (isPrimary) undoStack.save(primaryMapData)
    t.height = tilePanel.paintHeight
    sidebar.rebuildScene()
    return
  }

  // TilePanel flag paint mode: overwrite flags on the clicked tile.
  if (tilePanel.flagPaintMode) {
    const t = mapData?.mapTiles[editLevel]?.[localX]?.[localZ]
    if (!t) return
    if (isPrimary) undoStack.save(primaryMapData)
    t.flag = tilePanel.paintFlags
    sidebar.rebuildScene()
    return
  }

  // LocPanel add mode: place a new LOC in whichever region was clicked.
  if (locPanel.addMode) {
    if (isPrimary) undoStack.save(primaryMapData)
    mapData.locations.push(new LocData(editLevel, localX, localZ, locPanel.addLocId, locPanel.addShape))
    locPanel.refresh(primaryMapData, assetStore)
    sidebar.rebuildScene()
    return
  }

  // LocPanel move mode: only move within the same region.
  if (locPanel.moveMode && locPanel.selectedLoc) {
    if (!isPrimary) return
    const loc = locPanel.selectedLoc
    undoStack.save(primaryMapData)
    loc.x = localX; loc.z = localZ; loc.level = editLevel
    locPanel.exitMoveMode()
    locPanel.refresh(primaryMapData, assetStore)
    sidebar.rebuildScene()
    return
  }

  // ObjPanel add mode: place a new OBJ in whichever region was clicked.
  if (objPanel.addMode) {
    if (isPrimary) undoStack.save(primaryMapData)
    mapData.objects.push(new ObjData(editLevel, localX, localZ, objPanel.addObjId, 1))
    objPanel.refresh(primaryMapData, assetStore)
    sidebar.rebuildScene()
    return
  }

  // ObjPanel move mode: only move within the same region (cross-region not supported).
  if (objPanel.moveMode && objPanel.selectedObj) {
    if (!isPrimary) return
    const obj = objPanel.selectedObj
    undoStack.save(primaryMapData)
    obj.x = localX; obj.z = localZ; obj.level = editLevel
    objPanel.exitMoveMode()
    objPanel.refresh(primaryMapData, assetStore)
    sidebar.rebuildScene()
    return
  }

  // NpcPanel add mode: place a new NPC in whichever region was clicked.
  if (npcPanel.addMode) {
    if (isPrimary) undoStack.save(primaryMapData)
    mapData.npcs.push(new NpcData(editLevel, localX, localZ, npcPanel.addNpcId))
    npcPanel.refresh(primaryMapData, assetStore)
    sidebar.rebuildScene()
    return
  }

  // NpcPanel move mode: only move within the same region.
  if (npcPanel.moveMode && npcPanel.selectedNpc) {
    if (!isPrimary) return
    const npc = npcPanel.selectedNpc
    undoStack.save(primaryMapData)
    npc.x = localX; npc.z = localZ; npc.level = editLevel
    npcPanel.exitMoveMode()
    npcPanel.refresh(primaryMapData, assetStore)
    sidebar.rebuildScene()
    return
  }

  // L/N/O+click: place entity in whichever region was clicked.
  if (keysHeld.has('l')) {
    if (isPrimary) undoStack.save(primaryMapData)
    mapData.locations.push(new LocData(editLevel, localX, localZ, lastLocId, 10))
    window.dispatchEvent(new CustomEvent('editor:entityChanged'))
    return
  }
  if (keysHeld.has('n')) {
    if (isPrimary) undoStack.save(primaryMapData)
    mapData.npcs.push(new NpcData(editLevel, localX, localZ, lastNpcId))
    window.dispatchEvent(new CustomEvent('editor:entityChanged'))
    return
  }
  if (keysHeld.has('o')) {
    if (isPrimary) undoStack.save(primaryMapData)
    mapData.objects.push(new ObjData(editLevel, localX, localZ, lastObjId, 1))
    window.dispatchEvent(new CustomEvent('editor:entityChanged'))
    return
  }

  if (keysHeld.has('control')) {
    if (tile && isPrimary) {
      tileInspector.applyTo(tile)
      tileInspector.show(tile)
    }
    return
  }

  // Plain click: inspect tile and any entity at this position.
  tileInspector.show(tile ?? null)
  tilePanel.showTile(tile ?? null)

  // Entity interaction only for primary region.
  if (!isPrimary) { entityInspector.show(null, null); modelViewer.clear(); return }

  const locsHere = mapData.locations?.filter(e => e.x === localX && e.z === localZ && e.level === inspectLevel) ?? []
  // Prefer non-ground-decor (shape 22) so clicking a door selects the door, not its mat.
  const loc = locsHere.find(e => e.shape !== 22) ?? locsHere[0] ?? null
  if (loc) {
    lastLocId = loc.id
    entityInspector.show('loc', loc)
    locPanel.selectLoc(loc)
    const modelId = resolveEntityModelId('loc', loc, assetStore)
    if (modelId != null) modelViewer.showModel(modelId, assetStore)
    else modelViewer.clear()
    return
  }
  const npc = mapData.npcs?.find(e => e.x === localX && e.z === localZ && e.level === inspectLevel)
  if (npc) {
    lastNpcId = npc.id
    entityInspector.show('npc', npc)
    npcPanel.selectNpc(npc)
    const modelId = resolveEntityModelId('npc', npc, assetStore)
    if (modelId != null) modelViewer.showModel(modelId, assetStore)
    else modelViewer.clear()
    return
  }
  const obj = mapData.objects?.find(e => e.x === localX && e.z === localZ && e.level === inspectLevel)
  if (obj) {
    lastObjId = obj.id
    entityInspector.show('obj', obj)
    objPanel.selectObj(obj)
    const modelId = resolveEntityModelId('obj', obj, assetStore)
    if (modelId != null) modelViewer.showModel(modelId, assetStore)
    else modelViewer.clear()
    return
  }
  entityInspector.show(null, null)
  modelViewer.clear()
}

// Right-click: remove the first entity at the hovered tile.
// Right-click is used only for camera rotation (right-drag).
// Entity deletion is handled via the Delete buttons in NpcPanel and EntityInspector.

// Mini map
const miniMap = new MiniMap(
  document.getElementById('minimapCanvas'),
  camera,
  (tileX, tileZ) => {
    camera.position[0] = tileX * 128 + 64
    camera.position[2] = tileZ * 128 + 64
  }
)

// Status bar + mini map — refresh at 100ms.
const statusBar = document.getElementById('status-bar')
setInterval(() => {
  const t = renderer.scene.hoveredTile

  if (tilePanel.paintMode) {
    const name = tilePanel.selectedName ?? `#${tilePanel.selectedPackId}`
    statusBar.textContent = `Paint ${tilePanel.paintType} — klik op tiles om ${name} te schilderen  |  Esc om te stoppen`
    canvas.style.cursor = 'crosshair'
  } else if (tilePanel.heightPaintMode) {
    statusBar.textContent = `Paint height ${tilePanel.paintHeight} — klik op tiles om hoogte in te stellen  |  Esc om te stoppen`
    canvas.style.cursor = 'crosshair'
  } else if (tilePanel.flagPaintMode) {
    statusBar.textContent = `Paint flags 0x${tilePanel.paintFlags.toString(16)} — klik op tiles om flags in te stellen  |  Esc om te stoppen`
    canvas.style.cursor = 'crosshair'
  } else if (locPanel.addMode) {
    const name = assetStore.locPackMap?.get(locPanel.addLocId) ?? `loc_${locPanel.addLocId}`
    statusBar.textContent = `Add mode — klik op de kaart om ${name} te plaatsen  |  Esc om te stoppen`
    canvas.style.cursor = 'crosshair'
  } else if (locPanel.moveMode && locPanel.selectedLoc) {
    const name = assetStore.locPackMap?.get(locPanel.selectedLoc.id) ?? `loc_${locPanel.selectedLoc.id}`
    statusBar.textContent = `Move mode — klik op de kaart om ${name} te verplaatsen  |  Esc om te annuleren`
    canvas.style.cursor = 'crosshair'
  } else if (objPanel.addMode) {
    const name = assetStore.objPackMap?.get(objPanel.addObjId) ?? `obj_${objPanel.addObjId}`
    statusBar.textContent = `Add mode — klik op de kaart om ${name} te plaatsen  |  Esc om te stoppen`
    canvas.style.cursor = 'crosshair'
  } else if (objPanel.moveMode && objPanel.selectedObj) {
    const name = assetStore.objPackMap?.get(objPanel.selectedObj.id) ?? `obj_${objPanel.selectedObj.id}`
    statusBar.textContent = `Move mode — klik op de kaart om ${name} te verplaatsen  |  Esc om te annuleren`
    canvas.style.cursor = 'crosshair'
  } else if (npcPanel.addMode) {
    const name = assetStore.npcPackMap?.get(npcPanel.addNpcId) ?? `npc_${npcPanel.addNpcId}`
    statusBar.textContent = `Add mode — klik op de kaart om ${name} te plaatsen  |  Esc om te stoppen`
    canvas.style.cursor = 'crosshair'
  } else if (npcPanel.moveMode && npcPanel.selectedNpc) {
    const name = assetStore.npcPackMap?.get(npcPanel.selectedNpc.id) ?? `npc_${npcPanel.selectedNpc.id}`
    statusBar.textContent = `Move mode — klik op de kaart om ${name} te verplaatsen  |  Esc om te annuleren`
    canvas.style.cursor = 'crosshair'
  } else {
    canvas.style.cursor = ''
    if (t) statusBar.textContent = `Tile (${t.x}, ${t.z}) L${t.level}  |  ${renderer.scene.currentMapName ?? ''}`
  }

  const regions = renderer.scene.regions
    ?? (renderer.scene.mapData ? [{ mapData: renderer.scene.mapData, originX: 0, originZ: 0 }] : null)
  miniMap.render(regions, worldBuilder.floTypes, sidebar.currentLevel)
}, 100)

console.log('Lost City Map Editor — renderer started')
console.log('WebGL2 context:', renderer.gl.getParameter(renderer.gl.VERSION))
console.log('Electron API available:', typeof window.electronAPI !== 'undefined')
