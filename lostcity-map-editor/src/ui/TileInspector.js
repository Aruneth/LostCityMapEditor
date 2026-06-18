const SHAPE_NAMES = [
  '0 – Full square',
  '1 – Half (N)',
  '2 – Half (N+E)',
  '3 – Half (NE)',
  '4 – Half (NE+SE)',
  '5 – Half (NE+SE+SW)',
  '6 – Half (all)',
  '7 – Diagonal (NW)',
  '8 – Diagonal (NE)',
  '9 – Diagonal (SE)',
  '10 – Diagonal (SW)',
  '11 – Diagonal (half)',
  '12 – Diagonal (full)',
]

// Right-sidebar panel for inspecting and editing a single TileData.
export class TileInspector {
  constructor(container, onApply) {
    this._container = container
    this._onApply   = onApply    // (tile, values) → void — caller owns mutation + undo
    this._tile      = null
    this._build()
  }

  _build() {
    this._container.innerHTML = `
      <div id="tile-inspector-hint" class="placeholder" style="padding:8px 0;font-size:11px">Click a tile to inspect &amp; edit</div>
      <div class="inspector-section" id="tile-inspector" style="display:none">
        <h3>Tile <span id="tile-coord" style="color:#aaa;font-weight:normal"></span></h3>

        <div class="field-row">
          <label>Height</label>
          <input type="number" id="ti-height" step="8">
        </div>

        <div class="inspector-section" style="margin-top:8px;margin-bottom:0">
          <h3 style="color:#6a9a6a">Underlay</h3>
          <div class="field-row">
            <label>ID</label>
            <input type="number" id="ti-underlay-id" min="0">
          </div>
        </div>

        <div class="inspector-section" style="margin-top:6px;margin-bottom:0">
          <h3 style="color:#9a6a6a">Overlay</h3>
          <div class="field-row">
            <label>ID</label>
            <input type="number" id="ti-overlay-id" min="-1">
          </div>
          <div class="field-row">
            <label>Shape</label>
            <select id="ti-shape">
              ${SHAPE_NAMES.map((n,i) => `<option value="${i}">${n}</option>`).join('')}
            </select>
          </div>
          <div class="field-row">
            <label>Rotation</label>
            <select id="ti-rotation">
              <option value="0">0 (N)</option>
              <option value="1">1 (E)</option>
              <option value="2">2 (S)</option>
              <option value="3">3 (W)</option>
            </select>
          </div>
        </div>

        <div class="field-row" style="margin-top:6px">
          <label>Flag</label>
          <input type="number" id="ti-flag" min="0">
        </div>

        <button class="action" id="btn-apply-tile">Apply (Ctrl+Click)</button>
      </div>
    `

    document.getElementById('btn-apply-tile').addEventListener('click', () => this._apply())
  }

  // Populate the form with a TileData. Pass null to hide the panel.
  show(tile) {
    this._tile = tile
    const panel = document.getElementById('tile-inspector')

    const hint = document.getElementById('tile-inspector-hint')
    if (!tile) {
      panel.style.display = 'none'
      if (hint) hint.style.display = ''
      return
    }

    panel.style.display = ''
    if (hint) hint.style.display = 'none'
    document.getElementById('tile-coord').textContent = `(${tile.x}, ${tile.z})`
    document.getElementById('ti-height').value      = tile.height ?? 0
    document.getElementById('ti-underlay-id').value = tile.underlay?.id ?? 0
    document.getElementById('ti-overlay-id').value  = tile.overlay?.id ?? -1
    document.getElementById('ti-shape').value        = tile.shape    ?? 0
    document.getElementById('ti-rotation').value     = tile.rotation ?? 0
    document.getElementById('ti-flag').value         = tile.flag     ?? 0
  }

  get tile() { return this._tile }

  // Apply current form values to an arbitrary tile (Ctrl+click stamp).
  applyTo(tile) {
    this._tile = tile
    this._apply()
  }

  // Read form values and pass them to the callback without mutating the tile.
  // The caller (main.js) saves undo state first, then applies the values.
  _apply() {
    if (!this._tile) return
    this._onApply(this._tile, {
      height:    parseInt(document.getElementById('ti-height').value,      10) || 0,
      shape:     parseInt(document.getElementById('ti-shape').value,       10),
      rotation:  parseInt(document.getElementById('ti-rotation').value,    10),
      flag:      parseInt(document.getElementById('ti-flag').value,        10) || 0,
      underlayId: parseInt(document.getElementById('ti-underlay-id').value, 10),
      overlayId:  parseInt(document.getElementById('ti-overlay-id').value,  10),
    })
  }
}
