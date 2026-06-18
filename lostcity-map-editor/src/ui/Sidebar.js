import { chooseAndLoad }                      from '../loaders/FileLoader.js'
import { listMaps, loadMap, saveMap, exportMapAs } from '../loaders/MapDataLoader.js'
import { assetStore }                          from '../loaders/AssetStore.js'
import { worldBuilder }                        from '../renderer/WorldBuilder.js'
import { uploadTriangles, destroyVaoGroups }   from '../renderer/VertexDataHandler.js'
import { loadTextures, destroyTextures }       from '../renderer/TextureManager.js'

// Left sidebar — server dir picker, map list, level selector, toggles, export.
export class Sidebar {
  constructor(renderer) {
    this.renderer       = renderer
    this.currentLevel   = 0   // -1 means "all levels"
    this._build()
    this._bindProgressListener()
  }

  // The level to use for entity placement, tile editing, and entity inspection.
  // Always 0–3 even when currentLevel is -1 (all levels display).
  get editLevel() {
    return this.currentLevel < 0 ? 0 : this.currentLevel
  }

  _build() {
    const el = document.getElementById('sidebar-left')
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

      <div class="inspector-section" id="section-export" style="display:none">
        <h3>File</h3>
        <button class="action" id="btn-save-map">Save Map</button>
        <button class="action" id="btn-export-map" style="margin-top:4px">Export As…</button>
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

    document.getElementById('btn-save-map').addEventListener('click',   () => this._saveMap(false))
    document.getElementById('btn-export-map').addEventListener('click', () => this._saveMap(true))
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

    await this._populateMapList()

    document.getElementById('section-maps').style.display    = ''
    document.getElementById('section-level').style.display   = ''
    document.getElementById('section-toggles').style.display = ''
    document.getElementById('section-export').style.display  = ''

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
      const mapData = await loadMap(name)
      const { scene } = this.renderer
      scene.mapData        = mapData
      scene.currentMapName = name
      worldBuilder.initFloTypes(assetStore)
      this.rebuildScene()
      this._setStatus(`Loaded ${name}`)
    } catch (e) {
      console.error('Failed to load map:', e)
      this._setStatus(`Error loading ${name}`)
    }
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
      const triangles = worldBuilder.buildGeometry(scene.mapData, assetStore, currentLevel, options)
      scene.triangles = triangles
      scene.vaoGroups = uploadTriangles(gl, triangles)
      loadTextures(gl, scene.vaoGroups)
    })
  }

  async _saveMap(asDialog) {
    const { scene } = this.renderer
    if (!scene.mapData || !scene.currentMapName) return
    try {
      if (asDialog) {
        const ok = await exportMapAs(scene.mapData, scene.currentMapName)
        if (ok) this._setStatus('Exported.')
      } else {
        await saveMap(scene.mapData, scene.currentMapName)
        this._setStatus('Saved.')
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
