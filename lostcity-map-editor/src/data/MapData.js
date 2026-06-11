import { TileData } from './TileData.js'

const LEVELS = 4
const SIZE_X = 64
const SIZE_Z = 64

export class MapData {
  constructor() {
    // mapTiles[level][x][z] — matches Java's TileData[4][64][64]
    this.mapTiles  = this._emptyTileGrid()
    this.locations = []   // LocData[]
    this.npcs      = []   // NpcData[]
    this.objects   = []   // ObjData[]
  }

  _emptyTileGrid() {
    const grid = []
    for (let l = 0; l < LEVELS; l++) {
      grid[l] = []
      for (let x = 0; x < SIZE_X; x++) {
        grid[l][x] = new Array(SIZE_Z).fill(null)
      }
    }
    return grid
  }

  // Deep copy — used by UndoStack.save(). Every mutable object is cloned.
  clone() {
    const c = new MapData()

    for (let l = 0; l < LEVELS; l++) {
      for (let x = 0; x < SIZE_X; x++) {
        for (let z = 0; z < SIZE_Z; z++) {
          const t = this.mapTiles[l][x][z]
          c.mapTiles[l][x][z] = t != null ? t.clone() : null
        }
      }
    }

    c.locations = this.locations.map(loc => loc.clone())
    c.npcs      = this.npcs.map(npc => npc.clone())
    c.objects   = this.objects.map(obj => obj.clone())

    return c
  }

  // --- Loc helpers ---

  getLocData(level, x, z) {
    return this.locations.filter(l => l.level === level && l.x === x && l.z === z)
  }

  removeLocData(level, x, z) {
    this.locations = this.locations.filter(l => !(l.level === level && l.x === x && l.z === z))
  }

  // --- NPC helpers ---

  getNpcData(level, x, z) {
    return this.npcs.filter(n => n.level === level && n.x === x && n.z === z)
  }

  removeNpcData(level, x, z) {
    this.npcs = this.npcs.filter(n => !(n.level === level && n.x === x && n.z === z))
  }

  // --- Obj helpers ---

  getObjData(level, x, z) {
    return this.objects.filter(o => o.level === level && o.x === x && o.z === z)
  }

  removeObjData(level, x, z) {
    this.objects = this.objects.filter(o => !(o.level === level && o.x === x && o.z === z))
  }
}
