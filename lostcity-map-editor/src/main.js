import { Renderer }       from './renderer/Renderer.js'
import { ShaderManager }  from './renderer/ShaderManager.js'
import { Camera }         from './renderer/Camera.js'
import { Sidebar }        from './ui/Sidebar.js'
import { TileInspector }  from './ui/TileInspector.js'
import { EntityInspector } from './ui/EntityInspector.js'

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

renderer.start()

// Expose renderer globally so later modules (T12–T16, etc.) can attach.
window._renderer = renderer

// --- UI ---

const sidebar = new Sidebar(renderer)

// Right sidebar: TileInspector + EntityInspector, wired to renderer events.
const tileMount   = document.getElementById('tile-inspector-mount')
const entityMount = document.getElementById('entity-inspector-mount')

const tileInspector = new TileInspector(tileMount, (updatedTile) => {
  // T13: Ctrl+Click apply is handled here — undo push + scene rebuild.
  // For now the inspector shows changes instantly; the full undo hook is added in T16.
  const { scene } = renderer
  if (!scene.mapData) return
  scene.mapData.mapTiles[updatedTile.level][updatedTile.x][updatedTile.z] = updatedTile
  // Dispatch a custom event so T13/T16 can intercept.
  window.dispatchEvent(new CustomEvent('editor:tileChanged', { detail: updatedTile }))
})

const entityInspector = new EntityInspector(entityMount, (type, entity) => {
  // T14: Remove entity — dispatched so T14 wiring can handle undo + rebuild.
  window.dispatchEvent(new CustomEvent('editor:entityRemoved', { detail: { type, entity } }))
})

// Left-click: show tile + entity info in right sidebar.
renderer.onLeftClick = (keysHeld, hoveredTile) => {
  if (!hoveredTile || !renderer.scene.mapData) return
  const { x, z } = hoveredTile
  const level = sidebar.currentLevel
  const tile  = renderer.scene.mapData.mapTiles[level]?.[x]?.[z]
  tileInspector.show(tile ?? null)

  // Find the first entity at this tile position.
  const mapData = renderer.scene.mapData
  const loc = mapData.locations?.find(e => e.x === x && e.z === z && e.level === level)
  if (loc) { entityInspector.show('loc', loc); return }
  const npc = mapData.npcs?.find(e => e.x === x && e.z === z && e.level === level)
  if (npc) { entityInspector.show('npc', npc); return }
  const obj = mapData.objects?.find(e => e.x === x && e.z === z && e.level === level)
  if (obj) { entityInspector.show('obj', obj); return }
  entityInspector.show(null, null)
}

// Status bar — shows hovered tile coordinates.
const statusBar = document.getElementById('status-bar')
setInterval(() => {
  const t = renderer.scene.hoveredTile
  if (t) statusBar.textContent = `Tile (${t.x}, ${t.z})  |  ${renderer.scene.currentMapName ?? ''}`
}, 100)

console.log('Lost City Map Editor — renderer started')
console.log('WebGL2 context:', renderer.gl.getParameter(renderer.gl.VERSION))
console.log('Electron API available:', typeof window.electronAPI !== 'undefined')
