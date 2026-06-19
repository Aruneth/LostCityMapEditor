const LOC_SHAPES = [
  [0,  'Wall straight'],
  [1,  'Wall diag. corner'],
  [2,  'Wall L'],
  [3,  'Wall square corner'],
  [4,  'Decor straight'],
  [5,  'Decor straight (off.)'],
  [6,  'Decor diag. (off.)'],
  [7,  'Decor diag.'],
  [8,  'Decor diag. (both)'],
  [9,  'Wall diagonal'],
  [10, 'Centrepiece straight'],
  [11, 'Centrepiece diagonal'],
  [12, 'Roof straight'],
  [22, 'Ground decor'],
]

const SHAPE_OPTIONS = LOC_SHAPES.map(([v, l]) =>
  `<option value="${v}">${v} — ${l}</option>`).join('')

// LOC tab panel — list, select, move, apply shape/rotation, delete, add.
export class LocPanel {
  constructor(container) {
    this.container   = container
    this._mapData    = null
    this._store      = null
    this._selected   = null
    this.moveMode    = false
    this.addMode     = false
    this._addLocId   = 0
    this._addShape   = 10
    this._pickerOpen = false

    this._build()
  }

  get selectedLoc() { return this._selected }
  get addLocId()    { return this._addLocId }
  get addShape()    { return this._addShape }

  refresh(mapData, assetStore) {
    this._mapData = mapData
    this._store   = assetStore
    this._renderList()
    this._renderDetail()
  }

  selectLoc(loc) {
    this._selected = loc
    this.moveMode  = false
    this._renderList()
    this._renderDetail()
  }

  exitMoveMode() {
    this.moveMode = false
    const btn = this.container.querySelector('#btn-loc-moveon')
    if (btn) btn.classList.remove('active')
  }

  exitAddMode() {
    this.addMode     = false
    this._pickerOpen = false
    const btn = this.container.querySelector('#btn-loc-add')
    if (btn) btn.classList.remove('active')
    const picker = this.container.querySelector('#loc-picker')
    if (picker) picker.style.display = 'none'
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _build() {
    this.container.innerHTML = `
      <div class="inspector-section">
        <input id="loc-search" type="text" placeholder="Search LOC on map…"
          style="width:100%;background:#1a1a1a;border:1px solid #3a3a3a;
                 color:#e0e0e0;padding:3px 5px;font-family:monospace;font-size:12px">
      </div>
      <div id="loc-list" style="overflow-y:auto;max-height:150px"></div>

      <div style="padding:4px 0 2px">
        <button class="action" id="btn-loc-add">+ Add LOC</button>
      </div>

      <div id="loc-picker" style="display:none;margin-top:4px;border:1px solid #2a2a2a">
        <div style="padding:4px">
          <input id="loc-picker-search" type="text" placeholder="Search available LOCs…"
            style="width:100%;background:#1a1a1a;border:1px solid #3a3a3a;
                   color:#e0e0e0;padding:3px 5px;font-family:monospace;font-size:12px">
        </div>
        <div id="loc-picker-list" style="overflow-y:auto;max-height:200px"></div>
      </div>

      <div id="loc-detail" style="display:none">
        <div class="inspector-section" style="margin-top:8px">
          <h3 id="loc-detail-title">Selected LOC</h3>
          <div class="field-row">
            <label>X</label>
            <input id="loc-x" type="number" min="0" max="63">
          </div>
          <div class="field-row">
            <label>Z</label>
            <input id="loc-z" type="number" min="0" max="63">
          </div>
          <div class="field-row">
            <label>Level</label>
            <select id="loc-level">
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
          <div class="field-row">
            <label>Shape</label>
            <select id="loc-shape" style="flex:1;background:#1a1a1a;border:1px solid #3a3a3a;color:#e0e0e0;font-family:monospace;font-size:11px">
              ${SHAPE_OPTIONS}
            </select>
          </div>
          <div class="field-row">
            <label>Rotation</label>
            <select id="loc-rotation">
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
          <button class="action" id="btn-loc-apply" style="margin-top:6px">Apply</button>
          <button class="action" id="btn-loc-moveon" style="margin-top:4px">Move on click</button>
          <button class="action" id="btn-loc-delete"
            style="margin-top:4px;background:#4a1e1e;border-color:#6a3a3a;color:#d09090">Delete</button>
        </div>
      </div>
    `

    this.container.querySelector('#loc-search').addEventListener('input', () => this._renderList())

    this.container.querySelector('#btn-loc-add').addEventListener('click', () => {
      this._pickerOpen = !this._pickerOpen
      this.container.querySelector('#btn-loc-add').classList.toggle('active', this._pickerOpen)
      this.container.querySelector('#loc-picker').style.display = this._pickerOpen ? '' : 'none'
      if (this._pickerOpen) this._renderPicker()
    })

    this.container.querySelector('#loc-picker-search').addEventListener('input', () => this._renderPicker())

    this.container.querySelector('#btn-loc-apply').addEventListener('click', () => {
      if (!this._selected) return
      const x        = parseInt(this.container.querySelector('#loc-x').value,        10)
      const z        = parseInt(this.container.querySelector('#loc-z').value,        10)
      const level    = parseInt(this.container.querySelector('#loc-level').value,    10)
      const shape    = parseInt(this.container.querySelector('#loc-shape').value,    10)
      const rotation = parseInt(this.container.querySelector('#loc-rotation').value, 10)
      window.dispatchEvent(new CustomEvent('locpanel:apply', {
        detail: { loc: this._selected, x, z, level, shape, rotation }
      }))
    })

    this.container.querySelector('#btn-loc-moveon').addEventListener('click', () => {
      if (!this._selected) return
      this.moveMode = !this.moveMode
      this.container.querySelector('#btn-loc-moveon')
        .classList.toggle('active', this.moveMode)
    })

    this.container.querySelector('#btn-loc-delete').addEventListener('click', () => {
      if (!this._selected) return
      window.dispatchEvent(new CustomEvent('editor:entityRemoved', {
        detail: { type: 'loc', entity: this._selected }
      }))
      this._selected = null
      this.moveMode  = false
      this._renderList()
      this._renderDetail()
    })
  }

  _locName(id) {
    return this._store?.locPackMap?.get(id) ?? `loc_${id}`
  }

  _renderList() {
    const list  = this.container.querySelector('#loc-list')
    const query = (this.container.querySelector('#loc-search')?.value ?? '').toLowerCase()
    const locs  = this._mapData?.locations ?? []

    const filtered = query
      ? locs.filter(l => this._locName(l.id).toLowerCase().includes(query))
      : locs

    if (!filtered.length) {
      list.innerHTML = '<div class="placeholder" style="padding:4px 0">No LOCs on this map.</div>'
      return
    }

    list.innerHTML = filtered.map(loc => {
      const name     = this._locName(loc.id)
      const selected = loc === this._selected
      return `<div class="loc-item${selected ? ' selected' : ''}" data-idx="${locs.indexOf(loc)}"
        style="padding:4px 6px;cursor:pointer;border-bottom:1px solid #2a2a2a;
               background:${selected ? '#1e2a3a' : 'transparent'};
               color:${selected ? '#90b0d0' : '#ccc'}">
        <span style="color:#888;font-size:10px">#${loc.id}</span>
        ${name}
        <span style="float:right;color:#555;font-size:10px">(${loc.x},${loc.z}) s${loc.shape} r${loc.rotation ?? 0}</span>
      </div>`
    }).join('')

    list.querySelectorAll('.loc-item').forEach(el => {
      el.addEventListener('click', () => {
        const loc = locs[parseInt(el.dataset.idx, 10)]
        this._selected = loc
        this.moveMode  = false
        this._renderList()
        this._renderDetail()
      })
    })
  }

  _renderPicker() {
    const pickerList = this.container.querySelector('#loc-picker-list')
    const query      = (this.container.querySelector('#loc-picker-search')?.value ?? '').toLowerCase()
    const packMap    = this._store?.locPackMap

    if (!packMap || packMap.size === 0) {
      pickerList.innerHTML = '<div class="placeholder" style="padding:4px 6px">Load a server first.</div>'
      return
    }

    let entries = [...packMap.entries()]
    if (query) entries = entries.filter(([id, name]) =>
      name.toLowerCase().includes(query) || String(id).includes(query))

    entries.sort((a, b) => a[1].localeCompare(b[1]))

    if (!entries.length) {
      pickerList.innerHTML = '<div class="placeholder" style="padding:4px 6px">No matches.</div>'
      return
    }

    pickerList.innerHTML = entries.map(([id, name]) =>
      `<div class="loc-picker-item" data-id="${id}"
        style="padding:3px 6px;cursor:pointer;border-bottom:1px solid #1e1e1e;color:#ccc;
               font-family:monospace;font-size:12px">
        <span style="color:#666;font-size:10px">#${id}</span> ${name}
      </div>`
    ).join('')

    pickerList.querySelectorAll('.loc-picker-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = '#2a2a2a')
      el.addEventListener('mouseleave', () => el.style.background = '')
      el.addEventListener('click', () => {
        this._addLocId   = parseInt(el.dataset.id, 10)
        this._addShape   = 10
        this.addMode     = true
        this._pickerOpen = false
        this.container.querySelector('#loc-picker').style.display = 'none'
        this.container.querySelector('#btn-loc-add').classList.add('active')
      })
    })
  }

  _renderDetail() {
    const detail = this.container.querySelector('#loc-detail')
    if (!this._selected) {
      detail.style.display = 'none'
      return
    }
    detail.style.display = ''
    this.container.querySelector('#loc-detail-title').textContent =
      this._locName(this._selected.id)
    this.container.querySelector('#loc-x').value        = this._selected.x
    this.container.querySelector('#loc-z').value        = this._selected.z
    this.container.querySelector('#loc-level').value    = this._selected.level
    this.container.querySelector('#loc-shape').value    = this._selected.shape ?? 10
    this.container.querySelector('#loc-rotation').value = this._selected.rotation ?? 0
    this.container.querySelector('#btn-loc-moveon')
      .classList.toggle('active', this.moveMode)
  }
}
