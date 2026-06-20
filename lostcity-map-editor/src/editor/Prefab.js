import { TileData }     from '../data/TileData.js'
import { OverlayData }  from '../data/OverlayData.js'
import { UnderlayData } from '../data/UnderlayData.js'
import { LocData }      from '../data/LocData.js'
import { ObjData }      from '../data/ObjData.js'

export class Prefab {
  constructor(width, depth) {
    this.width = width
    this.depth = depth
    // tiles[level][rx][rz] = TileData | null
    this.tiles = []
    for (let l = 0; l < 4; l++) {
      this.tiles[l] = []
      for (let rx = 0; rx < width; rx++) {
        this.tiles[l][rx] = new Array(depth).fill(null)
      }
    }
    // Entities stored with relative (rx, rz) coords inside the prefab area.
    this.locs = []   // [{ rx, rz, level, id, shape, rotation }]
    this.objs = []   // [{ rx, rz, level, id, count }]
  }

  // Capture a rectangular area from mapData, all 4 levels + entities.
  static fromSelection(mapData, x0, z0, x1, z1) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1)
    const minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1)
    const W = maxX - minX + 1
    const D = maxZ - minZ + 1
    const p = new Prefab(W, D)

    for (let l = 0; l < 4; l++) {
      for (let rx = 0; rx < W; rx++) {
        for (let rz = 0; rz < D; rz++) {
          const t = mapData.mapTiles[l]?.[minX + rx]?.[minZ + rz]
          p.tiles[l][rx][rz] = t ? t.clone() : null
        }
      }
    }

    for (const loc of mapData.locations ?? []) {
      const rx = loc.x - minX, rz = loc.z - minZ
      if (rx < 0 || rx >= W || rz < 0 || rz >= D) continue
      p.locs.push({ rx, rz, level: loc.level, id: loc.id, shape: loc.shape, rotation: loc.rotation })
    }
    for (const obj of mapData.objects ?? []) {
      const rx = obj.x - minX, rz = obj.z - minZ
      if (rx < 0 || rx >= W || rz < 0 || rz >= D) continue
      p.objs.push({ rx, rz, level: obj.level, id: obj.id, count: obj.count })
    }

    return p
  }

  // Returns the placed [dx, dz] offset from origin for original tile (rx, rz).
  static rotateOffset(rx, rz, W, D, rotation) {
    switch (rotation) {
      case 1:  return [rz,       W - 1 - rx]   // 90°CW  (new W=D, new D=W)
      case 2:  return [W-1 - rx, D - 1 - rz]   // 180°
      case 3:  return [D-1 - rz, rx]            // 270°CW (new W=D, new D=W)
      default: return [rx,       rz]            // 0°
    }
  }

  // [rotatedWidth, rotatedDepth] after applying rotation.
  rotatedSize(rotation) {
    if (rotation === 1 || rotation === 3) return [this.depth, this.width]
    return [this.width, this.depth]
  }

  // Stamp this prefab onto mapData at (originX, originZ) in local tile coords.
  // Clears all existing entities in the target area first, then places tiles + entities.
  applyTo(mapData, originX, originZ, rotation) {
    const { width: W, depth: D } = this
    const [rW, rD] = this.rotatedSize(rotation)

    // Overwrite tiles.
    for (let l = 0; l < 4; l++) {
      for (let rx = 0; rx < W; rx++) {
        for (let rz = 0; rz < D; rz++) {
          const [dx, dz] = Prefab.rotateOffset(rx, rz, W, D, rotation)
          const tx = originX + dx, tz = originZ + dz
          if (tx < 0 || tx >= 64 || tz < 0 || tz >= 64) continue
          const src = this.tiles[l][rx][rz]
          if (src) {
            const placed = src.clone()
            placed.x = tx; placed.z = tz; placed.level = l
            mapData.mapTiles[l][tx][tz] = placed
          } else {
            mapData.mapTiles[l][tx][tz] = null
          }
        }
      }
    }

    // Remove existing entities in the destination area.
    const inArea = e =>
      e.x >= originX && e.x < originX + rW &&
      e.z >= originZ && e.z < originZ + rD
    mapData.locations = (mapData.locations ?? []).filter(e => !inArea(e))
    mapData.npcs      = (mapData.npcs      ?? []).filter(e => !inArea(e))
    mapData.objects   = (mapData.objects   ?? []).filter(e => !inArea(e))

    // Place prefab entities.
    for (const ent of this.locs) {
      const [dx, dz] = Prefab.rotateOffset(ent.rx, ent.rz, W, D, rotation)
      const tx = originX + dx, tz = originZ + dz
      if (tx < 0 || tx >= 64 || tz < 0 || tz >= 64) continue
      const placed = new LocData(ent.level, tx, tz, ent.id, ent.shape)
      placed.rotation = ent.rotation != null ? (ent.rotation + rotation) % 4 : null
      mapData.locations.push(placed)
    }
    for (const ent of this.objs) {
      const [dx, dz] = Prefab.rotateOffset(ent.rx, ent.rz, W, D, rotation)
      const tx = originX + dx, tz = originZ + dz
      if (tx < 0 || tx >= 64 || tz < 0 || tz >= 64) continue
      mapData.objects.push(new ObjData(ent.level, tx, tz, ent.id, ent.count))
    }
  }

  serialize() {
    const t = {}
    for (let l = 0; l < 4; l++) {
      t[l] = {}
      for (let rx = 0; rx < this.width; rx++) {
        for (let rz = 0; rz < this.depth; rz++) {
          const tile = this.tiles[l][rx][rz]
          if (!tile) continue
          t[l][`${rx},${rz}`] = {
            height:     tile.height     ?? 0,
            underlayId: tile.underlay?.id ?? 0,
            overlayId:  tile.overlay  != null ? tile.overlay.id : -1,
            shape:      tile.shape      ?? 0,
            rotation:   tile.rotation   ?? 0,
            flag:       tile.flag       ?? 0,
          }
        }
      }
    }
    return JSON.stringify({
      version: 2,
      width:   this.width,
      depth:   this.depth,
      tiles:   t,
      locs:    this.locs,
      objs:    this.objs,
    }, null, 2)
  }

  static deserialize(json) {
    const data = JSON.parse(json)
    const p = new Prefab(data.width, data.depth)

    for (let l = 0; l < 4; l++) {
      const lev = data.tiles?.[l] ?? {}
      for (let rx = 0; rx < data.width; rx++) {
        for (let rz = 0; rz < data.depth; rz++) {
          const e = lev[`${rx},${rz}`]
          if (!e) continue
          const td = new TileData(l, rx, rz)
          td.height   = e.height   ?? 0
          td.shape    = e.shape    ?? 0
          td.rotation = e.rotation ?? 0
          td.flag     = e.flag     ?? 0
          if ((e.underlayId ?? 0) > 0)   td.underlay = new UnderlayData(e.underlayId)
          if ((e.overlayId  ?? -1) >= 0) td.overlay  = new OverlayData(e.overlayId)
          p.tiles[l][rx][rz] = td
        }
      }
    }

    // version 2+ includes entities; version 1 files get empty arrays (already initialised).
    p.locs = data.locs ?? []
    p.objs = data.objs ?? []

    return p
  }
}
