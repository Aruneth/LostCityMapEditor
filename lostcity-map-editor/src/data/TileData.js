import { OverlayData } from './OverlayData.js'
import { UnderlayData } from './UnderlayData.js'

export class TileData {
  constructor(level, x, z) {
    this.level    = level
    this.x        = x
    this.z        = z
    this.height   = 0
    this.overlay  = null   // OverlayData | null
    this.shape    = null   // Integer | null
    this.rotation = null   // Integer | null
    this.flag     = null   // Integer | null
    this.underlay = null   // UnderlayData | null
    this.perlin   = false
  }

  clone() {
    const c = new TileData(this.level, this.x, this.z)
    c.height   = this.height
    c.shape    = this.shape
    c.rotation = this.rotation
    c.flag     = this.flag
    c.perlin   = this.perlin
    c.overlay  = this.overlay  != null ? this.overlay.clone()  : null
    c.underlay = this.underlay != null ? this.underlay.clone() : null
    return c
  }
}
