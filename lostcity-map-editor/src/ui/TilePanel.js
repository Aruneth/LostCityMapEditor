// ── Shape icon rendering ──────────────────────────────────────────────────────
// Mirrors the SHAPE_POINTS / SHAPE_PATHS tables in WorldBuilder.js.
// tile.shape 0–11 maps to render-shape 1–12 (WorldBuilder adds +1).

const _S_PTS = [
  null,                      // 0 — unused
  [1,3,5,7],                 // 1
  [1,3,5,7],                 // 2
  [1,3,5,7,6],               // 3
  [1,3,5,7,6],               // 4
  [1,3,5,7,6],               // 5
  [1,3,5,7,6],               // 6
  [1,3,5,7,2,6],             // 7
  [1,3,5,7,2,8],             // 8
  [1,3,5,7,2,8],             // 9
  [1,3,5,7,11,12],           // 10
  [1,3,5,7,11,12],           // 11
  [1,3,5,7,13,14],           // 12
]

const _S_PATHS = [
  null,
  [1,1,2,3, 1,0,1,3],
  [0,1,2,3, 1,0,1,3],
  [0,0,1,2, 0,0,2,4, 1,0,4,3],
  [0,0,1,4, 0,0,4,3, 1,1,2,4],
  [0,0,4,3, 1,0,1,2, 1,0,2,4],
  [0,1,2,4, 1,0,1,4, 1,0,4,3],
  [0,4,1,2, 0,4,2,5, 1,0,4,5, 1,0,5,3],
  [0,4,1,2, 0,4,2,3, 0,4,3,5, 1,0,4,5],
  [0,0,4,5, 1,4,1,2, 1,4,2,3, 1,4,3,5],
  [0,0,1,5, 0,1,4,5, 0,1,2,4, 1,0,5,3, 1,5,4,3, 1,4,2,3],
  [1,0,1,5, 1,1,4,5, 1,1,2,4, 0,0,5,3, 0,5,4,3, 0,4,2,3],
  [1,0,5,4, 1,0,1,5, 0,0,4,3, 0,4,5,3, 0,5,2,3, 0,1,2,5],
]

// Generate an SVG string showing which part of the tile is overlaid (green) vs underlay (dark).
// tileShape: the value stored in tile.shape (0–11).
function _shapeIconSVG(tileShape, sz = 34, overlayColor = '#4a8a4a', underlayColor = '#2e2e2e') {
  const rs = tileShape + 1   // render-shape index
  const pts  = _S_PTS[rs]
  const path = _S_PATHS[rs]
  if (!pts || !path) return ''

  const H = sz / 2, Q = sz / 4, T = sz * 3 / 4
  const V = {
    1: [0, sz],  2: [H, sz],  3: [sz, sz],
    4: [sz, H],  5: [sz, 0],  6: [H, 0],
    7: [0, 0],   8: [0, H],
    9: [H, T],  10: [T, H],  11: [H, Q], 12: [Q, H],
    13:[Q, T],  14: [T, T],  15: [T, Q], 16:[Q, Q],
  }

  const triCount = (path.length / 4) | 0
  let polys = ''
  for (let t = 0; t < triCount; t++) {
    const flag = path[t * 4]
    const a = path[t * 4 + 1], b = path[t * 4 + 2], c = path[t * 4 + 3]
    const [ax, ay] = V[pts[a]]
    const [bx, by] = V[pts[b]]
    const [cx, cy] = V[pts[c]]
    const fill = flag ? overlayColor : underlayColor
    polys += `<polygon points="${ax},${ay} ${bx},${by} ${cx},${cy}" fill="${fill}" stroke="#111" stroke-width="0.5"/>`
  }

  return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0">
    <rect width="${sz}" height="${sz}" fill="${underlayColor}"/>
    ${polys}
    <rect width="${sz}" height="${sz}" fill="none" stroke="#555" stroke-width="0.5"/>
  </svg>`
}

// Valid tile.shape values: 0–11 (render-shape 1–12).
const VALID_SHAPES = [0,1,2,3,4,5,6,7,8,9,10,11]

export class TilePanel {
  constructor(container) {
    this.container       = container
    this.paintMode       = false
    this.heightPaintMode = false
    this.flagPaintMode   = false
    this._paintType      = 'underlay'
    this._selectedPackId = null
    this._paintShape     = 0
    this._paintRotation  = 0
    this._paintHeight    = 0
    this._paintFlags     = 0
    this._pickerOpen     = false
    this._floTypes       = null
    this._assetStore     = null
    this._build()
  }

  get paintType()      { return this._paintType }
  get selectedPackId() { return this._selectedPackId }
  get paintShape()     { return this._paintShape }
  get paintRotation()  { return this._paintRotation }
  get paintHeight()    { return this._paintHeight }
  get paintFlags()     { return this._paintFlags }
  get selectedName() {
    if (this._selectedPackId == null || !this._assetStore) return null
    const raw = this._assetStore.floPackMap.get(this._selectedPackId)
    return raw ? raw.replace(/^\[|\]$/g, '') : null
  }

  // Called when the user clicks a tile — syncs flag checkboxes to that tile's current values.
  showTile(tile) {
    const info  = this.container.querySelector('#tile-flag-current')
    const coord = this.container.querySelector('#tile-flag-coord')
    const raw   = this.container.querySelector('#tile-flag-raw')
    if (!tile) {
      if (info) info.style.display = 'none'
      return
    }
    const f = tile.flag ?? 0
    if (info)  info.style.display = ''
    if (coord) coord.textContent = `(${tile.x}, ${tile.z}) L${tile.level}`
    if (raw)   raw.textContent   = `${f} (0x${f.toString(16)})`
    const c1  = this.container.querySelector('#tile-flag-1')
    const c2  = this.container.querySelector('#tile-flag-2')
    const c16 = this.container.querySelector('#tile-flag-16')
    if (c1)  c1.checked  = !!(f & 0x01)
    if (c2)  c2.checked  = !!(f & 0x02)
    if (c16) c16.checked = !!(f & 0x10)
  }

  refresh(assetStore, floTypes) {
    this._assetStore = assetStore
    this._floTypes   = floTypes
    this._renderList()
  }

  exitPaintMode() {
    this.paintMode       = false
    this.heightPaintMode = false
    this.flagPaintMode   = false
    this._pickerOpen     = false
    const p  = this.container.querySelector('#btn-tile-paint')
    const h  = this.container.querySelector('#btn-tile-height')
    const f  = this.container.querySelector('#btn-tile-flags')
    const pk = this.container.querySelector('#tile-shape-picker')
    if (p)  p.classList.remove('active')
    if (h)  h.classList.remove('active')
    if (f)  f.classList.remove('active')
    if (pk) pk.style.display = 'none'
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _build() {
    this.container.innerHTML = `
      <div class="inspector-section">
        <h3>Floor type</h3>
        <div style="display:flex;gap:4px;margin-bottom:6px">
          <button class="action active" id="tile-type-underlay" style="flex:1;width:auto;margin-top:0">Underlay</button>
          <button class="action"        id="tile-type-overlay"  style="flex:1;width:auto;margin-top:0">Overlay</button>
        </div>
        <input id="tile-flo-search" type="text" placeholder="Search floor types…"
          style="width:100%;background:#1a1a1a;border:1px solid #3a3a3a;
                 color:#e0e0e0;padding:3px 5px;font-family:monospace;font-size:12px;
                 box-sizing:border-box;margin-bottom:4px">
        <div id="tile-flo-list" style="overflow-y:auto;max-height:200px;border:1px solid #2a2a2a"></div>

        <div id="tile-overlay-opts" style="display:none;margin-top:8px">

          <div class="field-row" style="align-items:flex-start">
            <label style="margin-top:6px">Shape</label>
            <div style="flex:1">
              <button id="btn-tile-shape" style="
                display:flex;align-items:center;gap:6px;
                background:#1a1a1a;border:1px solid #3a3a3a;color:#e0e0e0;
                padding:3px 6px;cursor:pointer;width:100%;font-family:monospace;font-size:11px">
                <span id="tile-shape-preview"></span>
                <span id="tile-shape-label">0 — Full</span>
                <span style="margin-left:auto;color:#666">▼</span>
              </button>

              <div id="tile-shape-picker" style="
                display:none;margin-top:2px;padding:6px;
                background:#1a1a1a;border:1px solid #3a3a3a">
                <div style="
                  display:grid;grid-template-columns:repeat(4,1fr);
                  gap:4px" id="tile-shape-grid"></div>
              </div>
            </div>
          </div>

          <div class="field-row" style="margin-top:6px">
            <label>Rotation</label>
            <select id="tile-paint-rotation">
              <option value="0">0</option><option value="1">1</option>
              <option value="2">2</option><option value="3">3</option>
            </select>
          </div>
        </div>

        <button class="action" id="btn-tile-paint" style="margin-top:6px;width:100%">
          Paint floor
        </button>
      </div>

      <div class="inspector-section" style="margin-top:8px">
        <h3>Flags</h3>
        <div id="tile-flag-current" style="display:none;margin-bottom:6px;padding:4px 6px;
          background:#1a1a1a;border:1px solid #2a2a2a;font-family:monospace;font-size:11px;color:#aaa">
          Geselecteerde tile: <span id="tile-flag-coord" style="color:#90b0d0"></span>
          &nbsp;—&nbsp; raw: <span id="tile-flag-raw" style="color:#e0e0e0"></span>
        </div>
        <label class="field-row" style="cursor:pointer;gap:6px">
          <input type="checkbox" id="tile-flag-1"> <span style="color:#aaa;font-size:11px">0x01</span> Blocked
        </label>
        <label class="field-row" style="cursor:pointer;gap:6px">
          <input type="checkbox" id="tile-flag-2"> <span style="color:#aaa;font-size:11px">0x02</span> Roof / bridge
        </label>
        <label class="field-row" style="cursor:pointer;gap:6px">
          <input type="checkbox" id="tile-flag-16"> <span style="color:#aaa;font-size:11px">0x10</span> Hidden (skip render)
        </label>
        <button class="action" id="btn-tile-flags" style="margin-top:4px;width:100%">
          Paint flags
        </button>
      </div>

      <div class="inspector-section" style="margin-top:8px">
        <h3>Height</h3>
        <div class="field-row">
          <label>Value</label>
          <input type="number" id="tile-height-val" step="8" value="0"
            style="flex:1;background:#1a1a1a;border:1px solid #3a3a3a;color:#e0e0e0;
                   font-family:monospace;font-size:12px;padding:2px 4px">
        </div>
        <button class="action" id="btn-tile-height" style="margin-top:4px;width:100%">
          Paint height
        </button>
      </div>
    `

    // Populate shape grid
    const grid = this.container.querySelector('#tile-shape-grid')
    VALID_SHAPES.forEach(s => {
      const cell = document.createElement('div')
      cell.dataset.shape = s
      cell.title = `Shape ${s}`
      cell.style.cssText = 'cursor:pointer;border:2px solid transparent;line-height:0'
      cell.innerHTML = _shapeIconSVG(s)
      cell.addEventListener('click', () => this._selectShape(s))
      grid.appendChild(cell)
    })

    // Set initial shape preview
    this._updateShapeButton()

    // Toggle shape picker
    this.container.querySelector('#btn-tile-shape').addEventListener('click', () => {
      this._pickerOpen = !this._pickerOpen
      const pk = this.container.querySelector('#tile-shape-picker')
      pk.style.display = this._pickerOpen ? 'block' : 'none'
    })

    // Type tabs
    this.container.querySelector('#tile-type-underlay').addEventListener('click', () => {
      this._paintType      = 'underlay'
      this._selectedPackId = null
      this.paintMode       = false
      this.container.querySelector('#tile-type-underlay').classList.add('active')
      this.container.querySelector('#tile-type-overlay').classList.remove('active')
      this.container.querySelector('#tile-overlay-opts').style.display = 'none'
      this.container.querySelector('#btn-tile-paint').classList.remove('active')
      this._renderList()
    })

    this.container.querySelector('#tile-type-overlay').addEventListener('click', () => {
      this._paintType      = 'overlay'
      this._selectedPackId = null
      this.paintMode       = false
      this.container.querySelector('#tile-type-underlay').classList.remove('active')
      this.container.querySelector('#tile-type-overlay').classList.add('active')
      this.container.querySelector('#tile-overlay-opts').style.display = ''
      this.container.querySelector('#btn-tile-paint').classList.remove('active')
      this._renderList()
    })

    this.container.querySelector('#tile-flo-search').addEventListener('input', () => this._renderList())

    this.container.querySelector('#tile-paint-rotation').addEventListener('change', e => {
      this._paintRotation = parseInt(e.target.value, 10)
    })

    this.container.querySelector('#btn-tile-paint').addEventListener('click', () => {
      if (this._selectedPackId == null) return
      this.heightPaintMode = false
      this.flagPaintMode   = false
      this._pickerOpen     = false
      this.container.querySelector('#tile-shape-picker').style.display = 'none'
      this.container.querySelector('#btn-tile-height').classList.remove('active')
      this.container.querySelector('#btn-tile-flags').classList.remove('active')
      this.paintMode = !this.paintMode
      this.container.querySelector('#btn-tile-paint').classList.toggle('active', this.paintMode)
    })

    this.container.querySelector('#btn-tile-height').addEventListener('click', () => {
      this._paintHeight = parseInt(this.container.querySelector('#tile-height-val').value, 10) || 0
      this.paintMode     = false
      this.flagPaintMode = false
      this._pickerOpen   = false
      this.container.querySelector('#tile-shape-picker').style.display = 'none'
      this.container.querySelector('#btn-tile-paint').classList.remove('active')
      this.container.querySelector('#btn-tile-flags').classList.remove('active')
      this.heightPaintMode = !this.heightPaintMode
      this.container.querySelector('#btn-tile-height').classList.toggle('active', this.heightPaintMode)
    })

    this.container.querySelector('#btn-tile-flags').addEventListener('click', () => {
      this._paintFlags = this._readFlagCheckboxes()
      this.paintMode       = false
      this.heightPaintMode = false
      this._pickerOpen     = false
      this.container.querySelector('#tile-shape-picker').style.display = 'none'
      this.container.querySelector('#btn-tile-paint').classList.remove('active')
      this.container.querySelector('#btn-tile-height').classList.remove('active')
      this.flagPaintMode = !this.flagPaintMode
      this.container.querySelector('#btn-tile-flags').classList.toggle('active', this.flagPaintMode)
    })
  }

  _selectShape(s) {
    this._paintShape = s
    this._pickerOpen = false
    this.container.querySelector('#tile-shape-picker').style.display = 'none'
    this._updateShapeButton()
    // Highlight selected cell
    this.container.querySelectorAll('#tile-shape-grid [data-shape]').forEach(el => {
      el.style.borderColor = parseInt(el.dataset.shape, 10) === s ? '#5090d0' : 'transparent'
    })
  }

  _updateShapeButton() {
    const preview = this.container.querySelector('#tile-shape-preview')
    const label   = this.container.querySelector('#tile-shape-label')
    if (preview) preview.innerHTML = _shapeIconSVG(this._paintShape, 20)
    if (label)   label.textContent = `Shape ${this._paintShape}`
  }

  _readFlagCheckboxes() {
    let v = 0
    if (this.container.querySelector('#tile-flag-1')?.checked)  v |= 0x01
    if (this.container.querySelector('#tile-flag-2')?.checked)  v |= 0x02
    if (this.container.querySelector('#tile-flag-16')?.checked) v |= 0x10
    return v
  }

  _hex(rgb) {
    return '#' + (rgb & 0xFFFFFF).toString(16).padStart(6, '0')
  }

  _renderList() {
    const list = this.container.querySelector('#tile-flo-list')
    if (!this._assetStore || !this._floTypes) {
      list.innerHTML = '<div class="placeholder" style="padding:4px 6px">Load a server first.</div>'
      return
    }

    const query  = (this.container.querySelector('#tile-flo-search')?.value ?? '').toLowerCase()
    const isOver = this._paintType === 'overlay'
    const entries = []

    for (const [packId, rawName] of this._assetStore.floPackMap) {
      const flo = this._floTypes[packId]
      if (!flo) continue
      if (flo.isOverlay !== isOver) continue
      const name = rawName.replace(/^\[|\]$/g, '')
      if (query && !name.toLowerCase().includes(query) && !String(packId).includes(query)) continue
      entries.push([packId, name, flo.rgb ?? 0])
    }

    entries.sort((a, b) => a[1].localeCompare(b[1]))

    if (!entries.length) {
      list.innerHTML = '<div class="placeholder" style="padding:4px 6px">No matches.</div>'
      return
    }

    list.innerHTML = entries.map(([packId, name, rgb]) => {
      const hex      = this._hex(rgb)
      const selected = packId === this._selectedPackId
      return `<div class="tile-flo-item" data-id="${packId}"
        style="padding:3px 6px;cursor:pointer;display:flex;align-items:center;gap:6px;
               border-bottom:1px solid #1a1a1a;
               background:${selected ? '#1e2a3a' : 'transparent'};
               color:${selected ? '#90b0d0' : '#ccc'};font-family:monospace;font-size:12px">
        <span style="display:inline-block;width:12px;height:12px;background:${hex};
                     border:1px solid #555;flex-shrink:0"></span>
        <span style="color:#666;font-size:10px">#${packId}</span>
        ${name}
      </div>`
    }).join('')

    list.querySelectorAll('.tile-flo-item').forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (parseInt(el.dataset.id, 10) !== this._selectedPackId) el.style.background = '#222'
      })
      el.addEventListener('mouseleave', () => {
        if (parseInt(el.dataset.id, 10) !== this._selectedPackId) el.style.background = ''
      })
      el.addEventListener('click', () => {
        this._selectedPackId = parseInt(el.dataset.id, 10)
        this._renderList()
      })
    })
  }
}
