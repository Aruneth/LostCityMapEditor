import { LocData } from './LocData.js'
import { NpcData } from './NpcData.js'
import { ObjData } from './ObjData.js'

// Snapshot of a single tile + its entities, used by the clipboard (T15).
export class CopiedTileData {
  constructor(tile, locs = [], npcs = [], objs = []) {
    this.level     = tile.level
    this.x         = tile.x
    this.z         = tile.z
    this.underlayId = tile.underlay != null ? tile.underlay.id : null
    this.overlayId  = tile.overlay  != null ? tile.overlay.id  : null
    this.height    = tile.height
    this.flag      = tile.flag
    this.shape     = tile.shape
    // Note: rotation here is the tile rotation, matching Java source behaviour.
    this.rotation  = tile.rotation
    this.perlin    = tile.perlin

    this.locs = locs.map(loc => {
      const l = new LocData(loc.level, loc.x, loc.z, loc.id, loc.shape)
      l.rotation = tile.rotation  // preserve Java source behaviour
      return l
    })

    this.npcs = npcs.map(npc => new NpcData(npc.level, npc.x, npc.z, npc.id))
    this.objs = objs.map(obj => new ObjData(obj.level, obj.x, obj.z, obj.id, obj.count))
  }
}
