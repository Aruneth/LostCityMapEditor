import { Prefab } from '../editor/Prefab.js'

export class PrefabPanel {
  constructor(container) {
    this._container      = container
    this.selectMode      = false
    this.placeMode       = false
    this.selectionCorner1 = null   // { x, z } local coords
    this.selectedPrefab  = null
    this.placeRotation   = 0
    this._loadedName     = null
    this._build()
  }

  // ── Called from main.js when user clicks in select mode ─────────────────────

  onFirstCorner(x, z) {
    this.selectionCorner1 = { x, z }
    const info = this._container.querySelector('#prefab-sel-info')
    if (info) info.textContent = `First corner: (${x}, ${z}) — drag to end point`
  }

  // Called by main.js after it called Prefab.fromSelection.
  setPrefab(prefab, name = null) {
    this.selectedPrefab = prefab
    this._loadedName    = name
    this.exitSelectMode()
    this._updateInfo()
    this._container.querySelector('#btn-prefab-save')?.removeAttribute('disabled')
    this._container.querySelector('#btn-prefab-place')?.removeAttribute('disabled')
  }

  exitSelectMode() {
    this.selectMode       = false
    this.selectionCorner1 = null
    this._container.querySelector('#btn-prefab-select')?.classList.remove('active')
    const cancel = this._container.querySelector('#btn-prefab-sel-cancel')
    if (cancel) cancel.style.display = 'none'
    this._updateInfo()
  }

  exitPlaceMode() {
    this.placeMode = false
    this._container.querySelector('#btn-prefab-place')?.classList.remove('active')
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _build() {
    this._container.innerHTML = `
      <div class="inspector-section">
        <h3>Selection</h3>
        <div id="prefab-sel-info" class="placeholder" style="font-size:11px;margin-bottom:4px">
          No selection
        </div>
        <div style="display:flex;gap:4px">
          <button class="action" id="btn-prefab-select" style="flex:1;width:auto;margin-top:0">
            Start selection
          </button>
          <button class="action" id="btn-prefab-sel-cancel"
            style="flex:1;width:auto;margin-top:0;display:none">
            Cancel
          </button>
        </div>
      </div>

      <div class="inspector-section">
        <h3>Prefab file</h3>
        <div id="prefab-file-name" class="placeholder" style="font-size:11px;margin-bottom:4px">
          Nothing loaded
        </div>
        <div style="display:flex;gap:4px">
          <button class="action" id="btn-prefab-save"
            style="flex:1;width:auto;margin-top:0" disabled>Save</button>
          <button class="action" id="btn-prefab-load"
            style="flex:1;width:auto;margin-top:0">Load</button>
        </div>
      </div>

      <div class="inspector-section">
        <h3>Place</h3>
        <div style="margin-bottom:4px;color:#aaa;font-size:11px">Rotation</div>
        <div style="display:flex;gap:4px;margin-bottom:6px">
          <button class="action active" id="btn-rot-0" style="flex:1;width:auto;margin-top:0">0°</button>
          <button class="action"        id="btn-rot-1" style="flex:1;width:auto;margin-top:0">90°</button>
          <button class="action"        id="btn-rot-2" style="flex:1;width:auto;margin-top:0">180°</button>
          <button class="action"        id="btn-rot-3" style="flex:1;width:auto;margin-top:0">270°</button>
        </div>
        <button class="action" id="btn-prefab-place" disabled>Place prefab</button>
      </div>
    `

    this._container.querySelector('#btn-prefab-select')
      .addEventListener('click', () => this._startSelect())
    this._container.querySelector('#btn-prefab-sel-cancel')
      .addEventListener('click', () => this.exitSelectMode())
    this._container.querySelector('#btn-prefab-save')
      .addEventListener('click', () => this._savePrefab())
    this._container.querySelector('#btn-prefab-load')
      .addEventListener('click', () => this._loadPrefab())
    this._container.querySelector('#btn-prefab-place')
      .addEventListener('click', () => this._togglePlaceMode())

    for (let r = 0; r < 4; r++) {
      this._container.querySelector(`#btn-rot-${r}`)
        .addEventListener('click', () => {
          this.placeRotation = r
          for (let i = 0; i < 4; i++) {
            this._container.querySelector(`#btn-rot-${i}`)
              ?.classList.toggle('active', i === r)
          }
          window.dispatchEvent(new CustomEvent('prefab:rotationChanged'))
        })
    }
  }

  _startSelect() {
    this.exitPlaceMode()
    this.selectMode       = true
    this.selectionCorner1 = null
    const info = this._container.querySelector('#prefab-sel-info')
    if (info) info.textContent = 'Drag on the map to select an area'
    this._container.querySelector('#btn-prefab-select')?.classList.add('active')
    const cancel = this._container.querySelector('#btn-prefab-sel-cancel')
    if (cancel) cancel.style.display = ''
  }

  _togglePlaceMode() {
    if (!this.selectedPrefab) return
    this.exitSelectMode()
    this.placeMode = !this.placeMode
    this._container.querySelector('#btn-prefab-place')
      ?.classList.toggle('active', this.placeMode)
  }

  _updateInfo() {
    const info = this._container.querySelector('#prefab-sel-info')
    const file = this._container.querySelector('#prefab-file-name')
    if (!info || !file) return

    if (!this.selectMode && this.selectedPrefab) {
      const { width: W, depth: D, locs, objs } = this.selectedPrefab
      const entCount = (locs?.length ?? 0) + (objs?.length ?? 0)
      const entStr   = entCount > 0 ? `, ${entCount} entity${entCount !== 1 ? 's' : ''}` : ''
      info.textContent = `Captured: ${W} × ${D} tiles${entStr}`
    } else if (!this.selectMode) {
      info.textContent = 'No selection'
    }

    if (this._loadedName) {
      file.textContent = this._loadedName
      file.style.color = '#90b0d0'
    } else {
      file.textContent = 'Nothing loaded'
      file.style.color = ''
    }
  }

  async _savePrefab() {
    if (!this.selectedPrefab) return
    const result = await window.electronAPI?.showSaveDialog({
      title: 'Save prefab',
      defaultPath: `${this._loadedName ?? 'prefab'}.json`,
      filters: [{ name: 'JSON Prefab', extensions: ['json'] }],
    })
    if (result?.canceled || !result?.filePath) return
    await window.electronAPI?.writeFile(result.filePath, this.selectedPrefab.serialize())
    this._loadedName = result.filePath.replace(/\\/g, '/').split('/').pop().replace(/\.json$/i, '')
    this._updateInfo()
  }

  async _loadPrefab() {
    const result = await window.electronAPI?.showOpenDialog({
      title: 'Load prefab',
      filters: [{ name: 'JSON Prefab', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result?.canceled || !result?.filePaths?.length) return
    try {
      const buf  = await window.electronAPI?.readFile(result.filePaths[0])
      const text = new TextDecoder().decode(buf)
      const prefab = Prefab.deserialize(text)
      const name   = result.filePaths[0].replace(/\\/g, '/').split('/').pop().replace(/\.json$/i, '')
      this.setPrefab(prefab, name)
    } catch (e) {
      console.error('Failed to load prefab:', e)
    }
  }
}
