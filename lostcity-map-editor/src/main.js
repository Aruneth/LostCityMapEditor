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

// Entity placement: ID of the last inspected entity per type, used as default for new placements.
let lastLocId = 0
let lastNpcId = 0
let lastObjId = 0

window.addEventListener('editor:entityChanged', () => {
  sidebar.rebuildScene()
})

window.addEventListener('editor:entityRemoved', (e) => {
  const { type, entity } = e.detail
  const { mapData } = renderer.scene
  if (!mapData) return
  undoStack.save(mapData)
  if (type === 'loc') mapData.locations = mapData.locations.filter(l => l !== entity)
  else if (type === 'npc') mapData.npcs = mapData.npcs.filter(n => n !== entity)
  else if (type === 'obj') mapData.objects = mapData.objects.filter(o => o !== entity)
  entityInspector.show(null, null)
  modelViewer.clear()
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
    undoStack.save(mapData)
    const pasted = clipboard.paste(hovered.x, hovered.z, sidebar.editLevel, mapData)
    if (pasted) sidebar.rebuildScene()
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

const entityInspector = new EntityInspector(entityMount, (type, entity) => {
  // T14: Remove entity — dispatched so T14 wiring can handle undo + rebuild.
  window.dispatchEvent(new CustomEvent('editor:entityRemoved', { detail: { type, entity } }))
})

// Left-click: place entity (L/N/O), apply tile (Ctrl), or inspect (plain).
renderer.onLeftClick = (keysHeld, hoveredTile) => {
  if (!hoveredTile || !renderer.scene.mapData) return
  const { x, z }    = hoveredTile
  const editLevel    = sidebar.editLevel                  // always 0–3, used for placement
  const inspectLevel = hoveredTile.level ?? editLevel     // level of the clicked triangle
  const { mapData }  = renderer.scene
  const tile         = mapData.mapTiles[inspectLevel]?.[x]?.[z]

  // L/N/O+click: place a new entity using the last-inspected ID of that type.
  if (keysHeld.has('l')) {
    undoStack.save(mapData)
    mapData.locations.push(new LocData(editLevel, x, z, lastLocId, 10))
    window.dispatchEvent(new CustomEvent('editor:entityChanged'))
    return
  }
  if (keysHeld.has('n')) {
    undoStack.save(mapData)
    mapData.npcs.push(new NpcData(editLevel, x, z, lastNpcId))
    window.dispatchEvent(new CustomEvent('editor:entityChanged'))
    return
  }
  if (keysHeld.has('o')) {
    undoStack.save(mapData)
    mapData.objects.push(new ObjData(editLevel, x, z, lastObjId, 1))
    window.dispatchEvent(new CustomEvent('editor:entityChanged'))
    return
  }

  if (keysHeld.has('control')) {
    // Ctrl+click: stamp current form values onto clicked tile, then refresh form.
    if (tile) {
      tileInspector.applyTo(tile)
      tileInspector.show(tile)
    }
    return
  }

  // Plain click: inspect tile and any entity at this position.
  tileInspector.show(tile ?? null)

  const loc = mapData.locations?.find(e => e.x === x && e.z === z && e.level === inspectLevel)
  if (loc) {
    lastLocId = loc.id
    entityInspector.show('loc', loc)
    const modelId = resolveEntityModelId('loc', loc, assetStore)
    if (modelId != null) modelViewer.showModel(modelId, assetStore)
    else modelViewer.clear()
    return
  }
  const npc = mapData.npcs?.find(e => e.x === x && e.z === z && e.level === inspectLevel)
  if (npc) {
    lastNpcId = npc.id
    entityInspector.show('npc', npc)
    const modelId = resolveEntityModelId('npc', npc, assetStore)
    if (modelId != null) modelViewer.showModel(modelId, assetStore)
    else modelViewer.clear()
    return
  }
  const obj = mapData.objects?.find(e => e.x === x && e.z === z && e.level === inspectLevel)
  if (obj) {
    lastObjId = obj.id
    entityInspector.show('obj', obj)
    const modelId = resolveEntityModelId('obj', obj, assetStore)
    if (modelId != null) modelViewer.showModel(modelId, assetStore)
    else modelViewer.clear()
    return
  }
  entityInspector.show(null, null)
  modelViewer.clear()
}

// Right-click: remove the first entity at the hovered tile.
renderer.onRightClick = (keysHeld, hoveredTile) => {
  if (!hoveredTile || !renderer.scene.mapData) return
  const { x, z }   = hoveredTile
  const level       = hoveredTile.level ?? sidebar.editLevel
  const { mapData } = renderer.scene

  const loc = mapData.locations?.find(e => e.x === x && e.z === z && e.level === level)
  if (loc) {
    window.dispatchEvent(new CustomEvent('editor:entityRemoved', { detail: { type: 'loc', entity: loc } }))
    return
  }
  const npc = mapData.npcs?.find(e => e.x === x && e.z === z && e.level === level)
  if (npc) {
    window.dispatchEvent(new CustomEvent('editor:entityRemoved', { detail: { type: 'npc', entity: npc } }))
    return
  }
  const obj = mapData.objects?.find(e => e.x === x && e.z === z && e.level === level)
  if (obj) {
    window.dispatchEvent(new CustomEvent('editor:entityRemoved', { detail: { type: 'obj', entity: obj } }))
  }
}

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
  if (t) statusBar.textContent = `Tile (${t.x}, ${t.z}) L${t.level}  |  ${renderer.scene.currentMapName ?? ''}`
  miniMap.render(renderer.scene.mapData, worldBuilder.floTypes, sidebar.currentLevel)
}, 100)

console.log('Lost City Map Editor — renderer started')
console.log('WebGL2 context:', renderer.gl.getParameter(renderer.gl.VERSION))
console.log('Electron API available:', typeof window.electronAPI !== 'undefined')
