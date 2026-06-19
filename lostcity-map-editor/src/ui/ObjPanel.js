// OBJ tab panel — list, select, move, delete, add.
export class ObjPanel {
  constructor(container) {
    this.container   = container
    this._mapData    = null
    this._store      = null
    this._selected   = null
    this.moveMode    = false
    this.addMode     = false
    this._addObjId   = 0
    this._pickerOpen = false

    this._build()
  }

  get selectedObj() { return this._selected }
  get addObjId()    { return this._addObjId }

  // Called after a map loads or scene rebuilds.
  refresh(mapData, assetStore) {
    this._mapData = mapData
    this._store   = assetStore
    if (this._selected && mapData && !mapData.objects.includes(this._selected)) {
      this._selected = null
      this.moveMode  = false
    }
    this._renderList()
    this._renderDetail()
  }

  // Select an OBJ from outside (e.g. when clicking the 3D view).
  selectObj(obj) {
    this._selected = obj
    this.moveMode  = false
    this._renderList()
    this._renderDetail()
  }

  exitMoveMode() {
    this.moveMode = false
    const btn = this.container.querySelector('#btn-obj-moveon')
    if (btn) btn.classList.remove('active')
  }

  exitAddMode() {
    this.addMode     = false
    this._pickerOpen = false
    const btn = this.container.querySelector('#btn-obj-add')
    if (btn) btn.classList.remove('active')
    const picker = this.container.querySelector('#obj-picker')
    if (picker) picker.style.display = 'none'
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _build() {
    this.container.innerHTML = `
      <div class="inspector-section">
        <input id="obj-search" type="text" placeholder="Search OBJ on map…"
          style="width:100%;background:#1a1a1a;border:1px solid #3a3a3a;
                 color:#e0e0e0;padding:3px 5px;font-family:monospace;font-size:12px">
      </div>
      <div id="obj-list" style="overflow-y:auto;max-height:150px"></div>

      <div style="padding:4px 0 2px">
        <button class="action" id="btn-obj-add">+ Add OBJ</button>
      </div>

      <div id="obj-picker" style="display:none;margin-top:4px;border:1px solid #2a2a2a">
        <div style="padding:4px">
          <input id="obj-picker-search" type="text" placeholder="Search available OBJs…"
            style="width:100%;background:#1a1a1a;border:1px solid #3a3a3a;
                   color:#e0e0e0;padding:3px 5px;font-family:monospace;font-size:12px">
        </div>
        <div id="obj-picker-list" style="overflow-y:auto;max-height:200px"></div>
      </div>

      <div id="obj-detail" style="display:none">
        <div class="inspector-section" style="margin-top:8px">
          <h3 id="obj-detail-title">Selected OBJ</h3>
          <div class="field-row">
            <label>X</label>
            <input id="obj-x" type="number" min="0" max="63">
          </div>
          <div class="field-row">
            <label>Z</label>
            <input id="obj-z" type="number" min="0" max="63">
          </div>
          <div class="field-row">
            <label>Level</label>
            <select id="obj-level">
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
          <div class="field-row">
            <label>Amount</label>
            <input id="obj-count" type="number" min="1" max="2147483647">
          </div>
          <button class="action" id="btn-obj-apply" style="margin-top:6px">Apply</button>
          <button class="action" id="btn-obj-moveon" style="margin-top:4px">Move on click</button>
          <button class="action" id="btn-obj-delete"
            style="margin-top:4px;background:#4a1e1e;border-color:#6a3a3a;color:#d09090">Delete</button>
        </div>
      </div>
    `

    this.container.querySelector('#obj-search').addEventListener('input', () => this._renderList())

    this.container.querySelector('#btn-obj-add').addEventListener('click', () => {
      this._pickerOpen = !this._pickerOpen
      this.container.querySelector('#btn-obj-add').classList.toggle('active', this._pickerOpen)
      this.container.querySelector('#obj-picker').style.display = this._pickerOpen ? '' : 'none'
      if (this._pickerOpen) this._renderPicker()
    })

    this.container.querySelector('#obj-picker-search').addEventListener('input', () => this._renderPicker())

    this.container.querySelector('#btn-obj-apply').addEventListener('click', () => {
      if (!this._selected) return
      const x     = parseInt(this.container.querySelector('#obj-x').value,     10)
      const z     = parseInt(this.container.querySelector('#obj-z').value,     10)
      const level = parseInt(this.container.querySelector('#obj-level').value, 10)
      const count = parseInt(this.container.querySelector('#obj-count').value, 10) || 1
      window.dispatchEvent(new CustomEvent('objpanel:move', {
        detail: { obj: this._selected, x, z, level, count }
      }))
    })

    this.container.querySelector('#btn-obj-moveon').addEventListener('click', () => {
      if (!this._selected) return
      this.moveMode = !this.moveMode
      this.container.querySelector('#btn-obj-moveon')
        .classList.toggle('active', this.moveMode)
    })

    this.container.querySelector('#btn-obj-delete').addEventListener('click', () => {
      if (!this._selected) return
      window.dispatchEvent(new CustomEvent('editor:entityRemoved', {
        detail: { type: 'obj', entity: this._selected }
      }))
      this._selected = null
      this.moveMode  = false
      this._renderList()
      this._renderDetail()
    })
  }

  _objName(id) {
    return this._store?.objPackMap?.get(id) ?? `obj_${id}`
  }

  _renderList() {
    const list  = this.container.querySelector('#obj-list')
    const query = (this.container.querySelector('#obj-search')?.value ?? '').toLowerCase()
    const objs  = this._mapData?.objects ?? []

    const filtered = query
      ? objs.filter(o => this._objName(o.id).toLowerCase().includes(query))
      : objs

    if (!filtered.length) {
      list.innerHTML = '<div class="placeholder" style="padding:4px 0">No OBJs on this map.</div>'
      return
    }

    list.innerHTML = filtered.map(obj => {
      const name     = this._objName(obj.id)
      const selected = obj === this._selected
      return `<div class="obj-item${selected ? ' selected' : ''}" data-idx="${objs.indexOf(obj)}"
        style="padding:4px 6px;cursor:pointer;border-bottom:1px solid #2a2a2a;
               background:${selected ? '#1e3a1e' : 'transparent'};
               color:${selected ? '#90d090' : '#ccc'}">
        <span style="color:#888;font-size:10px">#${obj.id}</span>
        ${name}
        <span style="float:right;color:#555;font-size:10px">x${obj.count} (${obj.x},${obj.z}) L${obj.level}</span>
      </div>`
    }).join('')

    list.querySelectorAll('.obj-item').forEach(el => {
      el.addEventListener('click', () => {
        const obj = objs[parseInt(el.dataset.idx, 10)]
        this._selected = obj
        this.moveMode  = false
        this._renderList()
        this._renderDetail()
      })
    })
  }

  _renderPicker() {
    const pickerList = this.container.querySelector('#obj-picker-list')
    const query      = (this.container.querySelector('#obj-picker-search')?.value ?? '').toLowerCase()
    const packMap    = this._store?.objPackMap

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
      `<div class="obj-picker-item" data-id="${id}"
        style="padding:3px 6px;cursor:pointer;border-bottom:1px solid #1e1e1e;color:#ccc;
               font-family:monospace;font-size:12px">
        <span style="color:#666;font-size:10px">#${id}</span> ${name}
      </div>`
    ).join('')

    pickerList.querySelectorAll('.obj-picker-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = '#2a2a2a')
      el.addEventListener('mouseleave', () => el.style.background = '')
      el.addEventListener('click', () => {
        this._addObjId   = parseInt(el.dataset.id, 10)
        this.addMode     = true
        this._pickerOpen = false
        this.container.querySelector('#obj-picker').style.display = 'none'
        this.container.querySelector('#btn-obj-add').classList.add('active')
      })
    })
  }

  _renderDetail() {
    const detail = this.container.querySelector('#obj-detail')
    if (!this._selected) {
      detail.style.display = 'none'
      return
    }
    detail.style.display = ''
    this.container.querySelector('#obj-detail-title').textContent =
      this._objName(this._selected.id)
    this.container.querySelector('#obj-x').value     = this._selected.x
    this.container.querySelector('#obj-z').value     = this._selected.z
    this.container.querySelector('#obj-level').value = this._selected.level
    this.container.querySelector('#obj-count').value = this._selected.count ?? 1
    this.container.querySelector('#btn-obj-moveon')
      .classList.toggle('active', this.moveMode)
  }
}
