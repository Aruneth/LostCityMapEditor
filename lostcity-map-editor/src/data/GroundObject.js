// Tile-level ground object holding a rendered model and its height.
// Used by WorldBuilder (T09) when positioning models on the terrain.
export class GroundObject {
  constructor(height, model) {
    this.height = height
    this.model  = model   // Ob2Model from T04 Ob2FileTransformer
  }
}
