// Plain data container — fields are populated by OverlayDataTransformer (T04),
// not in the constructor, to avoid circular dependencies.
export class OverlayData {
  constructor(id) {
    this.id      = id
    this.color   = 0       // RGB integer, set by transformer
    this.texture = null    // texture name string, set by transformer
    this.occlude = true    // set by transformer
  }

  clone() {
    const c = new OverlayData(this.id)
    c.color   = this.color
    c.texture = this.texture
    c.occlude = this.occlude
    return c
  }
}
