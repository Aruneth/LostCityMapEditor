// NPC tab panel — list, select, move, delete, add.
export class NpcPanel {
  constructor(container) {
    this.container   = container
    this._mapData    = null
    this._store      = null
    this._selected   = null
    this.moveMode    = false
    this.addMode     = false
    this._addNpcId   = 0
    this._pickerOpen = false

    this._build()
  }

  get selectedNpc() { return this._selected }
  get addNpcId()    { return this._addNpcId }

  // Called after a map loads or scene rebuilds.
  refresh(mapData, assetStore) {
    this._mapData = mapData
    this._store   = assetStore
    if (this._selected && mapData && !mapData.npcs.includes(this._selected)) {
      this._selected = null
      this.moveMode  = false
    }
    this._renderList()
    this._renderDetail()
  }

  // Select an NPC from outside (e.g. when clicking the 3D view).
  selectNpc(npc) {
    this._selected = npc
    this.moveMode  = false
    this._renderList()
    this._renderDetail()
  }

  // Called by main.js after a move-click is consumed.
  exitMoveMode() {
    this.moveMode = false
    const btn = this.container.querySelector('#btn-npc-moveon')
    if (btn) btn.classList.remove('active')
  }

  // Called by main.js on Esc or after add-click is consumed.
  exitAddMode() {
    this.addMode     = false
    this._pickerOpen = false
    const btn = this.container.querySelector('#btn-npc-add')
    if (btn) btn.classList.remove('active')
    const picker = this.container.querySelector('#npc-picker')
    if (picker) picker.style.display = 'none'
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _build() {
    this.container.innerHTML = `
      <div class="inspector-section">
        <input id="npc-search" type="text" placeholder="Search NPC on map…"
          style="width:100%;background:#1a1a1a;border:1px solid #3a3a3a;
                 color:#e0e0e0;padding:3px 5px;font-family:monospace;font-size:12px">
      </div>
      <div id="npc-list" style="overflow-y:auto;max-height:150px"></div>

      <div style="padding:4px 0 2px">
        <button class="action" id="btn-npc-add">+ Add NPC</button>
      </div>

      <div id="npc-picker" style="display:none;margin-top:4px;border:1px solid #2a2a2a">
        <div style="padding:4px">
          <input id="npc-picker-search" type="text" placeholder="Search available NPCs…"
            style="width:100%;background:#1a1a1a;border:1px solid #3a3a3a;
                   color:#e0e0e0;padding:3px 5px;font-family:monospace;font-size:12px">
        </div>
        <div id="npc-picker-list" style="overflow-y:auto;max-height:200px"></div>
      </div>

      <div id="npc-detail" style="display:none">
        <div class="inspector-section" style="margin-top:8px">
          <h3 id="npc-detail-title">Selected NPC</h3>
          <div class="field-row">
            <label>X</label>
            <input id="npc-x" type="number" min="0" max="63">
          </div>
          <div class="field-row">
            <label>Z</label>
            <input id="npc-z" type="number" min="0" max="63">
          </div>
          <div class="field-row">
            <label>Level</label>
            <select id="npc-level">
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
          <button class="action" id="btn-npc-apply" style="margin-top:6px">Apply</button>
          <button class="action" id="btn-npc-moveon" style="margin-top:4px">Move on click</button>
          <button class="action" id="btn-npc-delete"
            style="margin-top:4px;background:#4a1e1e;border-color:#6a3a3a;color:#d09090">Delete</button>
        </div>
      </div>
    `

    this.container.querySelector('#npc-search').addEventListener('input', () => this._renderList())

    this.container.querySelector('#btn-npc-add').addEventListener('click', () => {
      this._pickerOpen = !this._pickerOpen
      this.container.querySelector('#btn-npc-add').classList.toggle('active', this._pickerOpen)
      this.container.querySelector('#npc-picker').style.display = this._pickerOpen ? '' : 'none'
      if (this._pickerOpen) this._renderPicker()
    })

    this.container.querySelector('#npc-picker-search').addEventListener('input', () => this._renderPicker())

    this.container.querySelector('#btn-npc-apply').addEventListener('click', () => {
      if (!this._selected) return
      const x     = parseInt(this.container.querySelector('#npc-x').value,     10)
      const z     = parseInt(this.container.querySelector('#npc-z').value,     10)
      const level = parseInt(this.container.querySelector('#npc-level').value, 10)
      window.dispatchEvent(new CustomEvent('npcpanel:move', {
        detail: { npc: this._selected, x, z, level }
      }))
    })

    this.container.querySelector('#btn-npc-moveon').addEventListener('click', () => {
      if (!this._selected) return
      this.moveMode = !this.moveMode
      this.container.querySelector('#btn-npc-moveon')
        .classList.toggle('active', this.moveMode)
    })

    this.container.querySelector('#btn-npc-delete').addEventListener('click', () => {
      if (!this._selected) return
      window.dispatchEvent(new CustomEvent('editor:entityRemoved', {
        detail: { type: 'npc', entity: this._selected }
      }))
      this._selected = null
      this.moveMode  = false
      this._renderList()
      this._renderDetail()
    })
  }

  _npcName(id) {
    return this._store?.npcPackMap?.get(id) ?? `npc_${id}`
  }

  _renderList() {
    const list  = this.container.querySelector('#npc-list')
    const query = (this.container.querySelector('#npc-search')?.value ?? '').toLowerCase()
    const npcs  = this._mapData?.npcs ?? []

    const filtered = query
      ? npcs.filter(n => this._npcName(n.id).toLowerCase().includes(query))
      : npcs

    if (!filtered.length) {
      list.innerHTML = '<div class="placeholder" style="padding:4px 0">No NPCs on this map.</div>'
      return
    }

    list.innerHTML = filtered.map(npc => {
      const name     = this._npcName(npc.id)
      const selected = npc === this._selected
      return `<div class="npc-item${selected ? ' selected' : ''}" data-idx="${npcs.indexOf(npc)}"
        style="padding:4px 6px;cursor:pointer;border-bottom:1px solid #2a2a2a;
               background:${selected ? '#1e3a1e' : 'transparent'};
               color:${selected ? '#90d090' : '#ccc'}">
        <span style="color:#888;font-size:10px">#${npc.id}</span>
        ${name}
        <span style="float:right;color:#555;font-size:10px">(${npc.x},${npc.z}) L${npc.level}</span>
      </div>`
    }).join('')

    list.querySelectorAll('.npc-item').forEach(el => {
      el.addEventListener('click', () => {
        const npc = npcs[parseInt(el.dataset.idx, 10)]
        this._selected = npc
        this.moveMode  = false
        this._renderList()
        this._renderDetail()
      })
    })
  }

  _renderPicker() {
    const pickerList = this.container.querySelector('#npc-picker-list')
    const query      = (this.container.querySelector('#npc-picker-search')?.value ?? '').toLowerCase()
    const packMap    = this._store?.npcPackMap

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
      `<div class="npc-picker-item" data-id="${id}"
        style="padding:3px 6px;cursor:pointer;border-bottom:1px solid #1e1e1e;color:#ccc;
               font-family:monospace;font-size:12px">
        <span style="color:#666;font-size:10px">#${id}</span> ${name}
      </div>`
    ).join('')

    pickerList.querySelectorAll('.npc-picker-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = '#2a2a2a')
      el.addEventListener('mouseleave', () => el.style.background = '')
      el.addEventListener('click', () => {
        this._addNpcId   = parseInt(el.dataset.id, 10)
        this.addMode     = true
        this._pickerOpen = false
        this.container.querySelector('#npc-picker').style.display = 'none'
        this.container.querySelector('#btn-npc-add').classList.add('active')
      })
    })
  }

  _renderDetail() {
    const detail = this.container.querySelector('#npc-detail')
    if (!this._selected) {
      detail.style.display = 'none'
      return
    }
    detail.style.display = ''
    this.container.querySelector('#npc-detail-title').textContent =
      this._npcName(this._selected.id)
    this.container.querySelector('#npc-x').value     = this._selected.x
    this.container.querySelector('#npc-z').value     = this._selected.z
    this.container.querySelector('#npc-level').value = this._selected.level
    this.container.querySelector('#btn-npc-moveon')
      .classList.toggle('active', this.moveMode)
  }
}
