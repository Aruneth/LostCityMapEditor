export class LocData {
  constructor(level, x, z, id, shape) {
    this.level    = level
    this.x        = x
    this.z        = z
    this.id       = id
    this.shape    = shape
    this.rotation = null  // Integer | null
  }

  clone() {
    const c = new LocData(this.level, this.x, this.z, this.id, this.shape)
    c.rotation = this.rotation
    return c
  }

  toString() {
    return `LocData{level=${this.level}, x=${this.x}, z=${this.z}, id=${this.id}, shape=${this.shape}, rotation=${this.rotation}}`
  }
}
