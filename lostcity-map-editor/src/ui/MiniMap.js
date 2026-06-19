export class MiniMap {
  constructor(canvas, camera, onNavigate) {
    this.canvas     = canvas
    this.ctx        = canvas.getContext('2d')
    this.camera     = camera
    this.onNavigate = onNavigate   // (tileX, tileZ) → void
    this._totalW    = 64
    this._totalH    = 64

    canvas.addEventListener('click', e => this._onClick(e))
  }

  // Full render: tile colors + camera crosshair.
  // regions: [{ mapData, originX, originZ }] — from scene.regions, or null.
  // floTypes comes from worldBuilder.floTypes (null if no map loaded yet).
  render(regions, floTypes, level) {
    if (!regions || !floTypes) return

    // Calculate total grid extent
    let maxX = 0, maxZ = 0
    for (const r of regions) {
      maxX = Math.max(maxX, r.originX + 64)
      maxZ = Math.max(maxZ, r.originZ + 64)
    }
    if (maxX === 0 || maxZ === 0) return

    this._totalW = maxX
    this._totalH = maxZ

    if (this.canvas.width !== maxX || this.canvas.height !== maxZ) {
      this.canvas.width  = maxX
      this.canvas.height = maxZ
    }

    const lv  = level < 0 ? 0 : level
    const img = new ImageData(maxX, maxZ)
    const d   = img.data

    // Default fill: dark background, fully opaque
    for (let i = 3; i < d.length; i += 4) d[i] = 255

    for (const region of regions) {
      const { mapData, originX, originZ } = region
      if (!mapData) continue
      for (let x = 0; x < 64; x++) {
        for (let z = 0; z < 64; z++) {
          const tile = mapData.mapTiles[lv]?.[x]?.[z]
          let rgb = 0x222222
          if (tile) {
            const oid = tile.overlay?.id ?? -1
            const uid = tile.underlay?.id ?? 0
            if (oid >= 0 && floTypes[oid])       rgb = floTypes[oid].rgb       ?? 0x333333
            else if (uid > 0 && floTypes[uid-1]) rgb = floTypes[uid-1].rgb     ?? 0x333333
          }
          const wx = originX + x
          const wz = originZ + z
          // high Z = north = top of canvas
          const i = ((maxZ - 1 - wz) * maxX + wx) * 4
          d[i    ] = (rgb >> 16) & 0xFF
          d[i + 1] = (rgb >>  8) & 0xFF
          d[i + 2] =  rgb        & 0xFF
          d[i + 3] = 255
        }
      }
    }

    this.ctx.putImageData(img, 0, 0)
    this._drawBorders(regions, maxX, maxZ)
    this._drawCrosshair()
  }

  _drawBorders(regions, maxX, maxZ) {
    const ctx = this.ctx
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth   = 1
    for (const { originX, originZ } of regions) {
      // East seam line (canvas X = originX + 64, if within bounds)
      const cx = originX + 64
      if (cx < maxX) {
        ctx.beginPath()
        ctx.moveTo(cx, maxZ - 1 - originZ)
        ctx.lineTo(cx, maxZ - 1 - (originZ + 63))
        ctx.stroke()
      }
      // North seam line (canvas Y = maxZ - 1 - (originZ + 64), if within bounds)
      const cy = maxZ - 1 - (originZ + 64)
      if (cy >= 0) {
        ctx.beginPath()
        ctx.moveTo(originX, cy)
        ctx.lineTo(originX + 63, cy)
        ctx.stroke()
      }
    }
  }

  _drawCrosshair() {
    const W = this._totalW, H = this._totalH
    const cx      = Math.round(this.camera.position[0] / 128)
    const tileZ   = Math.round(this.camera.position[2] / 128)
    const canvasY = H - 1 - tileZ
    if (cx < 0 || cx >= W || canvasY < 0 || canvasY >= H) return

    const ctx = this.ctx
    ctx.fillStyle = '#000'
    ctx.fillRect(cx - 2, canvasY - 2, 5, 5)
    ctx.fillStyle = '#ffff00'
    ctx.fillRect(cx - 1, canvasY - 1, 3, 3)
  }

  _onClick(e) {
    const rect   = this.canvas.getBoundingClientRect()
    const W      = this._totalW
    const H      = this._totalH
    const scaleX = W / rect.width
    const scaleY = H / rect.height
    const tileX  = Math.max(0, Math.min(W - 1, Math.floor((e.clientX - rect.left) * scaleX)))
    const canvasY = Math.max(0, Math.min(H - 1, Math.floor((e.clientY - rect.top)  * scaleY)))
    const tileZ  = H - 1 - canvasY
    this.onNavigate(tileX, tileZ)
  }
}
