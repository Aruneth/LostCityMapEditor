import { assetStore } from '../loaders/AssetStore.js'

// Right-sidebar panel for inspecting a Loc, NPC, or Object on the hovered tile.
// Shows the relevant entity details and provides a Remove button.
export class EntityInspector {
  constructor(container, onRemove) {
    this._container = container
    this._onRemove  = onRemove  // (type: 'loc'|'npc'|'obj', entity) → void
    this._entity    = null
    this._type      = null      // 'loc' | 'npc' | 'obj'
    this._build()
  }

  _build() {
    this._container.innerHTML += `
      <div class="inspector-section" id="entity-inspector" style="display:none">
        <h3 id="entity-title">Entity</h3>

        <div class="field-row">
          <label>Type</label>
          <span id="ei-type" style="color:#aaa"></span>
        </div>
        <div class="field-row">
          <label>ID</label>
          <span id="ei-id" style="color:#e0e0e0"></span>
        </div>
        <div class="field-row" id="ei-name-row">
          <label>Name</label>
          <span id="ei-name" style="color:#aaa;word-break:break-all"></span>
        </div>
        <div class="field-row" id="ei-shape-row">
          <label>Shape</label>
          <span id="ei-shape" style="color:#aaa"></span>
        </div>
        <div class="field-row" id="ei-rotation-row">
          <label>Rotation</label>
          <span id="ei-rotation" style="color:#aaa"></span>
        </div>
        <div class="field-row" id="ei-count-row" style="display:none">
          <label>Count</label>
          <span id="ei-count" style="color:#aaa"></span>
        </div>
        <div class="field-row">
          <label>Pos</label>
          <span id="ei-pos" style="color:#aaa"></span>
        </div>

        <button class="action" id="btn-remove-entity" style="background:#4a1a1a;border-color:#6a2a2a;color:#d09090;margin-top:6px">
          Remove Entity
        </button>
      </div>
    `

    document.getElementById('btn-remove-entity').addEventListener('click', () => {
      if (this._entity && this._type && this._onRemove) {
        this._onRemove(this._type, this._entity)
      }
    })
  }

  // Show a Loc/NPC/Obj entity in the panel. Pass null to hide.
  show(type, entity) {
    this._type   = type
    this._entity = entity
    const panel  = document.getElementById('entity-inspector')

    if (!entity) {
      panel.style.display = 'none'
      return
    }

    panel.style.display = ''

    const titles = { loc: 'Location', npc: 'NPC', obj: 'Object' }
    document.getElementById('entity-title').textContent = titles[type] ?? 'Entity'
    document.getElementById('ei-type').textContent = type
    document.getElementById('ei-id').textContent   = entity.id

    // Resolve display name from the appropriate pack map
    let name = '—'
    if (type === 'loc' && assetStore.locPackMap.has(entity.id))
      name = assetStore.locPackMap.get(entity.id)
    else if (type === 'npc' && assetStore.npcPackMap.has(entity.id))
      name = assetStore.npcPackMap.get(entity.id)
    else if (type === 'obj' && assetStore.objPackMap.has(entity.id))
      name = assetStore.objPackMap.get(entity.id)
    document.getElementById('ei-name').textContent = name

    // Shape / rotation — Locs only
    const hasShape = type === 'loc'
    document.getElementById('ei-shape-row').style.display    = hasShape ? '' : 'none'
    document.getElementById('ei-rotation-row').style.display = hasShape ? '' : 'none'
    if (hasShape) {
      document.getElementById('ei-shape').textContent    = entity.shape    ?? '—'
      document.getElementById('ei-rotation').textContent = entity.rotation ?? '—'
    }

    // Count — Objects only
    const hasCount = type === 'obj'
    document.getElementById('ei-count-row').style.display = hasCount ? '' : 'none'
    if (hasCount) document.getElementById('ei-count').textContent = entity.count ?? 1

    document.getElementById('ei-pos').textContent = `(${entity.x}, ${entity.z}) L${entity.level}`
  }
}
