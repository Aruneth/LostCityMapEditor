const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs/promises')

let mainWindow = null
let worldMapWindow = null
let serverDir = null
let loadRadius = 1   // 0=1×1, 1=3×3, 2=5×5, 3=7×7, 4=9×9

function setLoadRadius(r) {
  loadRadius = r
  buildMenu()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('set-load-radius', r)
  }
}

function buildMenu() {
  const sizes = [[0,'1×1'],[1,'3×3'],[2,'5×5'],[3,'7×7'],[4,'9×9']]
  const template = [
    {
      label: 'File',
      submenu: [
        { role: process.platform === 'darwin' ? 'close' : 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'World Map',
          accelerator: 'F2',
          click: openWorldMap
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Settings',
      submenu: sizes.map(([v, l]) => ({
        label: `Load size: ${l}`,
        type: 'radio',
        checked: loadRadius === v,
        click: () => setLoadRadius(v),
      }))
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Lost City Map Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

function openWorldMap() {
  if (worldMapWindow && !worldMapWindow.isDestroyed()) {
    worldMapWindow.focus()
    return
  }
  worldMapWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'World Map',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  worldMapWindow.loadFile(path.join(__dirname, 'world-map.html'))
  worldMapWindow.setMenu(null)
  worldMapWindow.on('closed', () => { worldMapWindow = null })
}

app.whenReady().then(() => {
  buildMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.handle('read-file', async (_, filePath) => {
  const buffer = await fs.readFile(filePath)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
})

ipcMain.handle('read-dir', async (_, dirPath) => {
  return fs.readdir(dirPath)
})

ipcMain.handle('write-file', async (_, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf8')
})

ipcMain.handle('show-open-dialog', async (_, options) => {
  return dialog.showOpenDialog(options)
})

ipcMain.handle('show-save-dialog', async (_, options) => {
  return dialog.showSaveDialog(options)
})

ipcMain.handle('walk-dir', async (_, dirPath, ext) => {
  const results = []
  async function walk(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (!ext || entry.name.toLowerCase().endsWith(ext)) {
        results.push(full)
      }
    }
  }
  await walk(dirPath)
  return results
})

// ── FLO / minimap helpers ─────────────────────────────────────────────────────

let floTypesCache = null   // packId → rgb number, invalidated on server change

// Parses all .flo files under serverDir and builds floTypes.
async function buildFloTypes() {
  if (!serverDir) return []

  // 1. Parse flo.pack  (format: "id=name" per line)
  let floPackText
  try { floPackText = await fs.readFile(path.join(serverDir, 'pack', 'flo.pack'), 'utf8') }
  catch { return [] }

  const floPackMap = new Map()
  for (const raw of floPackText.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const id = parseInt(line.slice(0, eq), 10)
    if (!isNaN(id)) floPackMap.set(id, `[${line.slice(eq + 1).trim()}]`)
  }

  // 2. Walk serverDir for *.flo and merge underlay/overlay data
  const underlayMap = new Map()
  const overlayMap  = new Map()

  async function walkFlo(dir) {
    let entries
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
    await Promise.all(entries.map(async e => {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walkFlo(full)
      } else if (e.name.toLowerCase().endsWith('.flo')) {
        try { parseFlo(await fs.readFile(full, 'utf8'), underlayMap, overlayMap) } catch {}
      }
    }))
  }
  await walkFlo(serverDir)

  // 3. Build floTypes array indexed by packId
  const floTypes = []
  for (const [packId, name] of floPackMap) {
    if (overlayMap.has(name))       floTypes[packId] = overlayMap.get(name)
    else if (underlayMap.has(name)) floTypes[packId] = underlayMap.get(name)
    else                            floTypes[packId] = 0x333333
  }
  return floTypes
}

// Inline FLO file parser (mirrors FloFileTransformer.js, first-occurrence wins).
function parseFlo(text, underlayMap, overlayMap) {
  let currentName = null, rgb = null, isOverlay = null

  const flush = () => {
    if (!currentName) return
    if (isOverlay === true) {
      if (!overlayMap.has(currentName))  overlayMap.set(currentName, rgb ?? 0)
    } else if (rgb != null && !underlayMap.has(currentName)) {
      underlayMap.set(currentName, rgb)
    }
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue
    const nm = line.match(/\[(.*?)\]/)
    if (nm) {
      flush()
      currentName = `[${nm[1]}]`; rgb = null; isOverlay = null
    } else if (line.startsWith('rgb=') || line.startsWith('colour=')) {
      const p = parseInt(line.slice(line.indexOf('=') + 1).trim().replace('0x', ''), 16)
      if (!isNaN(p)) rgb = p
    } else if (line.startsWith('overlay=')) {
      isOverlay = line.slice(8).trim().toLowerCase() === 'yes'
    }
  }
  flush()
}

// ── IPC ──────────────────────────────────────────────────────────────────────

// Store the server directory so the world map window can request it.
ipcMain.handle('set-server-dir', (_, dir) => {
  serverDir     = dir
  floTypesCache = null   // invalidate so next minimap request re-reads FLO data
})

// Return sorted list of .jm2 basenames from serverDir/maps/.
// Return RGBA pixel data (64×64) for a single map's minimap.
ipcMain.handle('get-minimap', async (_, mapName) => {
  if (!floTypesCache) floTypesCache = await buildFloTypes()
  const floTypes = floTypesCache
  const SIZE = 64

  const pixels = new Uint8Array(SIZE * SIZE * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0x22; pixels[i + 1] = 0x22; pixels[i + 2] = 0x22; pixels[i + 3] = 255
  }

  try {
    const mapText = await fs.readFile(path.join(serverDir, 'maps', mapName), 'utf8')
    const TOKEN_RE = /h\d+|o(\d+)|r\d+|f\d+|u(\d+)|\d+/g
    let inMap = false

    for (const raw of mapText.split('\n')) {
      const line = raw.trim()
      if (line === '==== MAP ====') { inMap = true; continue }
      if (line.startsWith('===='))  { inMap = false; continue }
      if (!inMap || !line || line.startsWith('//')) continue

      const colon = line.indexOf(':')
      if (colon < 0) continue
      const parts = line.slice(0, colon).trim().split(' ')
      if (parts.length !== 3) continue
      if (parseInt(parts[0], 10) !== 0) continue   // level 0 only
      const x = parseInt(parts[1], 10)
      const z = parseInt(parts[2], 10)
      if (x < 0 || x >= SIZE || z < 0 || z >= SIZE) continue

      TOKEN_RE.lastIndex = 0
      let overlayId = -1, underlayId = 0, m
      while ((m = TOKEN_RE.exec(line.slice(colon + 1))) !== null) {
        if (m[1] != null) overlayId  = parseInt(m[1], 10) - 1   // o<n> → 0-based
        if (m[2] != null) underlayId = parseInt(m[2], 10)        // u<n>
      }

      let rgb = 0x222222
      if (overlayId >= 0 && floTypes[overlayId] != null)             rgb = floTypes[overlayId]
      else if (underlayId > 0 && floTypes[underlayId - 1] != null)   rgb = floTypes[underlayId - 1]

      // High Z = north = top of canvas
      const py = (SIZE - 1 - z) * SIZE + x
      pixels[py * 4]     = (rgb >> 16) & 0xFF
      pixels[py * 4 + 1] = (rgb >>  8) & 0xFF
      pixels[py * 4 + 2] =  rgb        & 0xFF
      pixels[py * 4 + 3] = 255
    }
  } catch (e) {
    console.error('get-minimap error for', mapName, e)
  }

  return pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength)
})

ipcMain.handle('get-map-list', async () => {
  if (!serverDir) return []
  try {
    const entries = await fs.readdir(path.join(serverDir, 'maps'))
    return entries
      .filter(n => n.toLowerCase().endsWith('.jm2'))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  } catch {
    return []
  }
})

// Renderer requests to open the world map window (e.g. F2 or button).
ipcMain.on('open-world-map', openWorldMap)

// World map window requests to open a map → forward to main renderer.
ipcMain.on('open-map', (_, name) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('load-map', name)
    mainWindow.focus()
  }
})
