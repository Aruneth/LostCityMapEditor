// Central container for all loaded server assets.
// Populated by FileLoader.loadFiles() and read by WorldBuilder, TextureManager, UI panels.
export class AssetStore {
  constructor() {
    // Pack ID maps (id → name) — from pack/ directory
    this.floPackMap     = new Map()   // Map<number, "[name]">  — overlay/underlay names
    this.texturePackMap = new Map()   // Map<number, name>
    this.locPackMap     = new Map()   // Map<number, name>
    this.npcPackMap     = new Map()   // Map<number, name>
    this.objPackMap     = new Map()   // Map<number, name>
    this.modelPackMap   = new Map()   // Map<name, number>  — reversed

    // Floor texture data — from .flo files
    this.underlayMap = new Map()      // Map<"[name]", rgb>
    this.overlayMap  = new Map()      // Map<"[name]", {rgb?, texture?, occlude}>

    // Script data — from scripts/ directory
    this.allLocMap = new Map()        // Map<name, props>
    this.allNpcMap = new Map()        // Map<name, props>
    this.allObjMap = new Map()        // Map<name, props>

    // Texture options — from textures/meta/*.opt
    this.textureOptsMap = new Map()   // Map<name, {cropX, cropY, width, height}>

    // 3D models — from models/*.ob2
    this.modelOb2Map = new Map()      // Map<id, Model>

    // Server directory path — set after the user picks one
    this.serverDir = null
  }
}

// Singleton shared across the renderer
export const assetStore = new AssetStore()
