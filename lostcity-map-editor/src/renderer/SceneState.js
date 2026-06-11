// Holds all mutable scene data shared between the render loop and editor actions.
export class SceneState {
  constructor() {
    this.triangles       = []          // Triangle[] — populated by T09 WorldBuilder
    this.vaoGroups       = new Map()   // textureId → { vao, count } — populated by T06 VertexDataHandler
    this.hoveredTile     = null        // { x, z } — updated by T12 MousePicker
    this.mapData         = null        // MapData — loaded by T04/T17
    this.currentMapName  = null        // string — the loaded .jm2 filename
    this.currentLevel    = 0           // 0–3, controlled by level selector (T11)
  }
}
