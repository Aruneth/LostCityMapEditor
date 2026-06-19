import { chooseAndLoad }                      from '../loaders/FileLoader.js'
import { listMaps, loadMapGrid, saveMap, exportMapAs } from '../loaders/MapDataLoader.js'
import { assetStore }                          from '../loaders/AssetStore.js'
import { worldBuilder }                        from '../renderer/WorldBuilder.js'
import { uploadTriangles, destroyVaoGroups }   from '../renderer/VertexDataHandler.js'
import { loadTextures, destroyTextures }       from '../renderer/TextureManager.js'
import { Triangle }                            from '../data/Triangle.js'

function _applyOriginOffset(triangles, originX, originZ) {
  const dx = originX * 128
  const dz = originZ * 128
  for (const t of triangles) {
    const v = t.vertices
    v[0] += dx; v[2] += dz
    v[3] += dx; v[5] += dz
    v[6] += dx; v[8] += dz
    t.tileX += originX
    t.tileZ += originZ
  }
}

// Creates thin flat cyan quads at every seam between adjacent regions.
function _buildRegionBorders(regions) {
  const LINE_W = 12   // half-width in world units (12 = ~1/10th of a tile)
  const out    = []

  const addQuad = (x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3) => {
    const mk = (ax, ay, az, bx, by, bz, cx, cy, cz) => new Triangle({
      tileX: -1, tileZ: -1, level: 0, shape: 0, rotation: 0,
      vertices: [ax, ay, az, bx, by, bz, cx, cy, cz],
      colors: null, rawColor: [0, 1, 1], textureId: -1,
    })
    out.push(mk(x0, y0, z0, x1, y1, z1, x2, y2, z2))
    out.push(mk(x0, y0, z0, x2, y2, z2, x3, y3, z3))
  }

  for (const region of regions) {
    const { mapData, originX, originZ } = region
    if (!mapData) continue
    const tiles = mapData.mapTiles[0]

    // East seam — only when a neighbor exists to the east.
    if (regions.some(r => r.originX === originX + 64 && r.originZ === originZ)) {
      const sx = (originX + 64) * 128
      for (let z = 0; z < 64; z++) {
        const h0 = tiles?.[63]?.[z]?.height     ?? 0
        const h1 = tiles?.[63]?.[z + 1 < 64 ? z + 1 : z]?.height ?? 0
        const wz0 = (originZ + z)     * 128
        const wz1 = (originZ + z + 1) * 128
        addQuad(sx - LINE_W, h0 - 1, wz0,  sx + LINE_W, h0 - 1, wz0,
                sx + LINE_W, h1 - 1, wz1,  sx - LINE_W, h1 - 1, wz1)
      }
    }

    // North seam — only when a neighbor exists to the north (higher Z).
    if (regions.some(r => r.originX === originX && r.originZ === originZ + 64)) {
      const sz = (originZ + 64) * 128
      for (let x = 0; x < 64; x++) {
        const h0 = tiles?.[x]?.[63]?.height                     ?? 0
        const h1 = tiles?.[x + 1 < 64 ? x + 1 : x]?.[63]?.height ?? 0
        const wx0 = (originX + x)     * 128
        const wx1 = (originX + x + 1) * 128
        addQuad(wx0, h0 - 1, sz - LINE_W,  wx0, h0 - 1, sz + LINE_W,
                wx1, h1 - 1, sz + LINE_W,  wx1, h1 - 1, sz - LINE_W)
      }
    }
  }
  return out
}

// Left sidebar — server dir picker, map list, level selector, toggles, export.
export class Sidebar {
  constructor(renderer) {
    this.renderer       = renderer
    this.currentLevel   = 0   // -1 means "all levels"
    this._loadRadius    = 1   // 0=1×1, 1=3×3, 2=5×5, 3=7×7, 4=9×9
    this._build()
    this._bindProgressListener()
    window.electronAPI?.onLoadRadius?.(r => this._setLoadRadius(r))
  }

  // The level to use for entity placement, tile editing, and entity inspection.
  // Always 0–3 even when currentLevel is -1 (all levels display).
  get editLevel() {
    return this.currentLevel < 0 ? 0 : this.currentLevel
  }

  _build() {
    const el = document.getElementById('sidebar-content')
    el.innerHTML = `
      <div class="inspector-section">
        <h3>Server</h3>
        <button class="action" id="btn-open-dir">Open Server Directory</button>
        <div id="server-dir-label" class="placeholder" style="margin-top:4px;word-break:break-all"></div>
      </div>

      <div class="inspector-section" id="section-maps" style="display:none">
        <h3>Map</h3>
        <select id="map-select" style="width:100%;background:#1a1a1a;border:1px solid #3a3a3a;color:#e0e0e0;font-family:monospace;font-size:12px;padding:2px 4px"></select>
        <button class="action" id="btn-load-map" style="margin-top:4px">Load Map</button>
      </div>

      <div class="inspector-section" id="section-level" style="display:none">
        <h3>Level</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${[0,1,2,3].map(i => `
            <label style="display:flex;align-items:center;gap:3px;color:#aaa">
              <input type="radio" name="level" value="${i}" ${i===0?'checked':''}>
              ${i}
            </label>`).join('')}
          <label style="display:flex;align-items:center;gap:3px;color:#aaa">
            <input type="radio" name="level" value="-1">
            All
          </label>
        </div>
      </div>

      <div class="inspector-section" id="section-toggles" style="display:none">
        <h3>Show</h3>
        <label class="field-row" style="cursor:pointer">
          <input type="checkbox" id="toggle-locs" checked> Locs
        </label>
        <label class="field-row" style="cursor:pointer">
          <input type="checkbox" id="toggle-npcs" checked> NPCs
        </label>
        <label class="field-row" style="cursor:pointer">
          <input type="checkbox" id="toggle-objs" checked> Objects
        </label>
      </div>

      <div class="inspector-section" id="section-loadsize" style="display:none">
        <h3>Load size</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[[0,'1×1'],[1,'3×3'],[2,'5×5'],[3,'7×7'],[4,'9×9']].map(([v,l]) => `
            <label style="display:flex;align-items:center;gap:3px;color:#aaa">
              <input type="radio" name="loadsize" value="${v}" ${v===1?'checked':''}> ${l}
            </label>`).join('')}
        </div>
      </div>

      <div class="inspector-section" id="section-export" style="display:none">
        <h3>File</h3>
        <button class="action" id="btn-save-map">Save Map</button>
        <button class="action" id="btn-export-map" style="margin-top:4px">Export As…</button>
        <button class="action" id="btn-world-map" style="margin-top:4px">World Map  [F2]</button>
      </div>

      <div id="loader-status" class="placeholder" style="margin-top:8px;font-size:11px"></div>
    `

    document.getElementById('btn-open-dir').addEventListener('click', () => this._openDir())
    document.getElementById('btn-load-map').addEventListener('click', () => this._loadSelectedMap())

    document.querySelectorAll('input[name="level"]').forEach(radio => {
      radio.addEventListener('change', e => {
        this.currentLevel = parseInt(e.target.value, 10)
        if (this.renderer.scene.mapData) this.rebuildScene()
      })
    })

    ;['toggle-locs', 'toggle-npcs', 'toggle-objs'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        if (this.renderer.scene.mapData) this.rebuildScene()
      })
    })

    document.querySelectorAll('input[name="loadsize"]').forEach(radio => {
      radio.addEventListener('change', e => {
        this._setLoadRadius(parseInt(e.target.value, 10))
      })
    })

    document.getElementById('btn-save-map').addEventListener('click',   () => this._saveMap(false))
    document.getElementById('btn-export-map').addEventListener('click', () => this._saveMap(true))
    document.getElementById('btn-world-map').addEventListener('click',  () => window.electronAPI?.openWorldMap?.())
  }

  _bindProgressListener() {
    window.addEventListener('loader:progress', e => {
      const el = document.getElementById('loader-status')
      if (el) el.textContent = e.detail
    })
  }

  async _openDir() {
    const store = await chooseAndLoad()
    if (!store) return

    document.getElementById('server-dir-label').textContent = assetStore.serverDir
    document.getElementById('loader-status').textContent = ''

    window.electronAPI?.setServerDir?.(assetStore.serverDir)

    await this._populateMapList()

    document.getElementById('section-maps').style.display     = ''
    document.getElementById('section-level').style.display    = ''
    document.getElementById('section-loadsize').style.display = ''
    document.getElementById('section-toggles').style.display  = ''
    document.getElementById('section-export').style.display   = ''

    // Auto-load m50_50.jm2 if present; otherwise load the first map in the list.
    const select = document.getElementById('map-select')
    if (select.options.length > 0) {
      const defaultOpt = Array.from(select.options).find(o => o.value === 'm50_50.jm2')
      if (defaultOpt) select.value = 'm50_50.jm2'
      this._loadSelectedMap()
    }
  }

  async _populateMapList() {
    const names  = await listMaps()
    const select = document.getElementById('map-select')
    select.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('')
  }

  async _loadSelectedMap() {
    const name = document.getElementById('map-select').value
    if (!name) return
    this._setStatus(`Loading ${name}…`)

    try {
      const { regions } = await loadMapGrid(name, this._loadRadius)
      const { scene }   = this.renderer
      const primary     = regions.find(r => r.isPrimary) ?? regions[0]
      scene.mapData        = primary.mapData
      scene.regions        = regions
      scene.currentMapName = name
      worldBuilder.initFloTypes(assetStore)
      this.rebuildScene()
      window.dispatchEvent(new CustomEvent('map:loaded', {
        detail: { primaryOriginX: primary.originX, primaryOriginZ: primary.originZ }
      }))
      this._setStatus(`Loaded ${name}`)
    } catch (e) {
      console.error('Failed to load map:', e)
      this._setStatus(`Error loading ${name}`)
    }
  }

  // Load a map by name from outside (e.g. world map window).
  loadMap(name) {
    const select = document.getElementById('map-select')
    if (!select) return
    const opt = Array.from(select.options).find(o => o.value === name)
    if (opt) {
      select.value = name
      this._loadSelectedMap()
    }
  }

  _setLoadRadius(r) {
    this._loadRadius = r
    const radio = document.querySelector(`input[name="loadsize"][value="${r}"]`)
    if (radio) radio.checked = true
    if (this.renderer.scene.currentMapName) this._loadSelectedMap()
  }

  // Queue a full scene rebuild on the GL thread.
  // Reads the current entity visibility toggles and passes them to WorldBuilder.
  rebuildScene() {
    const { renderer, currentLevel } = this
    const { gl, scene } = renderer
    const options = {
      showLocs: document.getElementById('toggle-locs')?.checked ?? true,
      showNpcs: document.getElementById('toggle-npcs')?.checked ?? true,
      showObjs: document.getElementById('toggle-objs')?.checked ?? true,
    }
    renderer.enqueue(() => {
      destroyTextures(gl, scene.vaoGroups)
      destroyVaoGroups(gl, scene.vaoGroups)
      const regions = scene.regions ?? [{ mapData: scene.mapData, originX: 0, originZ: 0 }]
      let allTriangles = []
      for (const region of regions) {
        if (!region.mapData) continue
        const find = (dx, dz) => regions.find(r => r.originX === region.originX + dx * 64 && r.originZ === region.originZ + dz * 64)
        const neighborMaps = {
          east:      find(+1,  0)?.mapData,
          north:     find( 0, +1)?.mapData,
          northeast: find(+1, +1)?.mapData,
        }
        const tris = worldBuilder.buildGeometry(region.mapData, assetStore, currentLevel, options, neighborMaps)
        if (region.originX !== 0 || region.originZ !== 0) _applyOriginOffset(tris, region.originX, region.originZ)
        allTriangles = allTriangles.concat(tris)
      }
      allTriangles = allTriangles.concat(_buildRegionBorders(regions))
      scene.triangles = allTriangles
      scene.vaoGroups = uploadTriangles(gl, allTriangles)
      loadTextures(gl, scene.vaoGroups)
    })
  }

  async _saveMap(asDialog) {
    const { scene } = this.renderer
    if (!scene.mapData || !scene.currentMapName) return
    try {
      if (asDialog) {
        // Export As: only the primary region
        const ok = await exportMapAs(scene.mapData, scene.currentMapName)
        if (ok) this._setStatus('Exported.')
      } else {
        // Save all loaded regions
        const regions = scene.regions ?? [{ mapData: scene.mapData, name: scene.currentMapName }]
        for (const r of regions) {
          if (r.mapData && r.name) await saveMap(r.mapData, r.name)
        }
        this._setStatus(`Saved ${regions.filter(r => r.mapData && r.name).length} region(s).`)
      }
    } catch (e) {
      console.error('Save failed:', e)
      this._setStatus('Save failed.')
    }
  }

  _setStatus(msg) {
    const el = document.getElementById('loader-status')
    if (el) el.textContent = msg
  }
}
