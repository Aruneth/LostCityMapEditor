import { CopiedTileData } from '../data/CopiedTileData.js'
import { LocData }         from '../data/LocData.js'
import { NpcData }         from '../data/NpcData.js'
import { ObjData }         from '../data/ObjData.js'
import { OverlayData }     from '../data/OverlayData.js'
import { UnderlayData }    from '../data/UnderlayData.js'

export class Clipboard {
  constructor() {
    this._copied = null
  }

  // Snapshot a tile + its entities into the clipboard.
  copy(tile, locs = [], npcs = [], objs = []) {
    this._copied = new CopiedTileData(tile, locs, npcs, objs)
  }

  hasCopy() {
    return this._copied !== null
  }

  // Write clipboard tile fields and entities onto the target (x, z, level) in mapData.
  // Existing entities at the target are replaced.
  // Returns false if nothing is in the clipboard.
  paste(x, z, level, mapData) {
    if (!this._copied) return false
    const c      = this._copied
    const target = mapData.mapTiles[level]?.[x]?.[z]
    if (!target) return false

    target.height   = c.height
    target.shape    = c.shape
    target.rotation = c.rotation
    target.flag     = c.flag
    target.perlin   = c.perlin

    if (c.underlayId != null) {
      if (!target.underlay) target.underlay = new UnderlayData()
      target.underlay.id = c.underlayId
    } else {
      target.underlay = null
    }

    if (c.overlayId != null) {
      if (!target.overlay) target.overlay = new OverlayData(c.overlayId)
      target.overlay.id = c.overlayId
    } else {
      target.overlay = null
    }

    // Replace entities at target tile with copies from the clipboard.
    mapData.locations = mapData.locations.filter(l => !(l.x === x && l.z === z && l.level === level))
    for (const loc of c.locs) {
      const l = new LocData(level, x, z, loc.id, loc.shape)
      l.rotation = loc.rotation
      mapData.locations.push(l)
    }

    mapData.npcs = mapData.npcs.filter(n => !(n.x === x && n.z === z && n.level === level))
    for (const npc of c.npcs) {
      mapData.npcs.push(new NpcData(level, x, z, npc.id))
    }

    mapData.objects = mapData.objects.filter(o => !(o.x === x && o.z === z && o.level === level))
    for (const obj of c.objs) {
      mapData.objects.push(new ObjData(level, x, z, obj.id, obj.count))
    }

    return true
  }
}
