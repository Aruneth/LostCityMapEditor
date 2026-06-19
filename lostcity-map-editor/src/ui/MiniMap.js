const SIZE = 64   // tile grid is always 64×64

export class MiniMap {
  constructor(canvas, camera, onNavigate) {
    this.canvas     = canvas
    this.ctx        = canvas.getContext('2d')
    this.camera     = camera
    this.onNavigate = onNavigate   // (tileX, tileZ) → void

    canvas.addEventListener('click', e => this._onClick(e))
  }

  // Full render: tile colors + camera crosshair.
  // floTypes comes from worldBuilder.floTypes (null if no map loaded yet).
  render(mapData, floTypes, level) {
    if (!mapData || !floTypes) return

    const lv  = level < 0 ? 0 : level
    const img = new ImageData(SIZE, SIZE)
    const d   = img.data

    for (let x = 0; x < SIZE; x++) {
      for (let z = 0; z < SIZE; z++) {
        const tile = mapData.mapTiles[lv]?.[x]?.[z]
        let rgb = 0x222222
        if (tile) {
          const oid = tile.overlay?.id ?? -1
          const uid = tile.underlay?.id ?? 0
          if (oid >= 0 && floTypes[oid])       rgb = floTypes[oid].rgb       ?? 0x333333
          else if (uid > 0 && floTypes[uid-1]) rgb = floTypes[uid-1].rgb     ?? 0x333333
        }
        // canvas X = tile X, canvas Y = tile Z (Z=0 at top)
        const i  = (z * SIZE + x) * 4
        d[i    ] = (rgb >> 16) & 0xFF
        d[i + 1] = (rgb >>  8) & 0xFF
        d[i + 2] =  rgb        & 0xFF
        d[i + 3] = 255
      }
    }

    this.ctx.putImageData(img, 0, 0)
    this._drawCrosshair()
  }

  _drawCrosshair() {
    const cx = Math.round(this.camera.position[0] / 128)
    const cz = Math.round(this.camera.position[2] / 128)
    if (cx < 0 || cx >= SIZE || cz < 0 || cz >= SIZE) return

    const ctx = this.ctx
    // Dark outline so it's visible on any tile color
    ctx.fillStyle = '#000'
    ctx.fillRect(cx - 2, cz - 2, 5, 5)
    ctx.fillStyle = '#ffff00'
    ctx.fillRect(cx - 1, cz - 1, 3, 3)
  }

  _onClick(e) {
    const rect   = this.canvas.getBoundingClientRect()
    const scaleX = SIZE / rect.width
    const scaleY = SIZE / rect.height
    const tileX  = Math.max(0, Math.min(SIZE - 1, Math.floor((e.clientX - rect.left) * scaleX)))
    const tileZ  = Math.max(0, Math.min(SIZE - 1, Math.floor((e.clientY - rect.top)  * scaleY)))
    this.onNavigate(tileX, tileZ)
  }
}
