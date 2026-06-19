/**
 * WorldBuilder — port of World.java + World3D.java.
 *
 * Converts MapData → Triangle[] for the current display level.
 * Pix3D software rasterisation is omitted; triangles go straight to the WebGL pipeline.
 */

import { Triangle, SKIP_COLOR } from '../data/Triangle.js'

const MAX_TILES = 64

// ── Loc shape constants (LocType.java) ───────────────────────────────────────
const LOC_WALL_STRAIGHT               = 0
const LOC_WALL_DIAGONALCORNER         = 1
const LOC_WALL_L                      = 2
const LOC_WALL_SQUARECORNER           = 3
const LOC_WALLDECOR_STRAIGHT_NOOFFSET = 4
const LOC_WALLDECOR_STRAIGHT_OFFSET   = 5
const LOC_WALLDECOR_DIAGONAL_OFFSET   = 6
const LOC_WALLDECOR_DIAGONAL_NOOFFSET = 7
const LOC_WALLDECOR_DIAGONAL_BOTH     = 8
const LOC_WALL_DIAGONAL               = 9
const LOC_CENTREPIECE_STRAIGHT        = 10
const LOC_CENTREPIECE_DIAGONAL        = 11
const LOC_ROOF_STRAIGHT               = 12
const LOC_GROUNDDECOR                 = 22

// ── Tile overlay shape tables (TileOverlay.java) ─────────────────────────────
// Vertex type indices per shape (0 = unused, 1–12 = used for tiles with overlayId > 0).
const SHAPE_POINTS = [
  [1, 3, 5, 7],           // 0 — not used for overlay tiles
  [1, 3, 5, 7],           // 1 — plain
  [1, 3, 5, 7],           // 2 — diagonal
  [1, 3, 5, 7, 6],        // 3 — left semi-diag small
  [1, 3, 5, 7, 6],        // 4 — right semi-diag small
  [1, 3, 5, 7, 6],        // 5 — left semi-diag big
  [1, 3, 5, 7, 6],        // 6 — right semi-diag big
  [1, 3, 5, 7, 2, 6],     // 7 — half square
  [1, 3, 5, 7, 2, 8],     // 8 — corner small
  [1, 3, 5, 7, 2, 8],     // 9 — corner big
  [1, 3, 5, 7, 11, 12],   // 10 — fan small
  [1, 3, 5, 7, 11, 12],   // 11 — fan big
  [1, 3, 5, 7, 13, 14],   // 12 — trapezium
]

// Triangle definitions per shape: groups of 4 [colorFlag, a, b, c].
// colorFlag 0 = underlay (primary) colour, 1 = overlay (secondary) colour.
// Indices < 4 are the corner vertices (get rotation-adjusted); >= 4 are midpoints (fixed).
const SHAPE_PATHS = [
  [0, 1, 2, 3,  0, 0, 1, 3],
  [1, 1, 2, 3,  1, 0, 1, 3],
  [0, 1, 2, 3,  1, 0, 1, 3],
  [0, 0, 1, 2,  0, 0, 2, 4,  1, 0, 4, 3],
  [0, 0, 1, 4,  0, 0, 4, 3,  1, 1, 2, 4],
  [0, 0, 4, 3,  1, 0, 1, 2,  1, 0, 2, 4],
  [0, 1, 2, 4,  1, 0, 1, 4,  1, 0, 4, 3],
  [0, 4, 1, 2,  0, 4, 2, 5,  1, 0, 4, 5,  1, 0, 5, 3],
  [0, 4, 1, 2,  0, 4, 2, 3,  0, 4, 3, 5,  1, 0, 4, 5],
  [0, 0, 4, 5,  1, 4, 1, 2,  1, 4, 2, 3,  1, 4, 3, 5],
  [0, 0, 1, 5,  0, 1, 4, 5,  0, 1, 2, 4,  1, 0, 5, 3,  1, 5, 4, 3,  1, 4, 2, 3],
  [1, 0, 1, 5,  1, 1, 4, 5,  1, 1, 2, 4,  0, 0, 5, 3,  0, 5, 4, 3,  0, 4, 2, 3],
  [1, 0, 5, 4,  1, 0, 1, 5,  0, 0, 4, 3,  0, 4, 5, 3,  0, 5, 2, 3,  0, 1, 2, 5],
]

const ROTATION_WALL_DECORATION_FWD_X = [1, 0, -1, 0]
const ROTATION_WALL_DECORATION_FWD_Z = [0, -1, 0, 1]

const SHAPE_SUFFIX_MAP = new Map([
  [0,  '_1'], [1,  '_2'], [2,  '_3'], [3,  '_4'], [4,  '_q'], [5,  '_w'],
  [6,  '_r'], [7,  '_e'], [8,  '_t'], [9,  '_5'], [10, '_8'], [11, '_9'],
  [12, '_a'], [13, '_s'], [14, '_d'], [15, '_f'], [16, '_g'], [17, '_h'],
  [18, '_z'], [19, '_x'], [20, '_c'], [21, '_v'], [22, '_0'],
])

const SUFFIXES = [
  '_1','_2','_3','_4','_5','_q','_w','_e','_r','_t',
  '_8','_9','_0','_a','_s','_d','_f','_g','_h','_z','_x','_c','_v',
]

// ── Lighting constants (World.build) ─────────────────────────────────────────
const LIGHT_AMBIENT     = 96
const LIGHT_ATTENUATION = 768
const LIGHT_X = -50, LIGHT_Y = -10, LIGHT_Z = -50
// Integer math mirrors Java: (int) Math.sqrt(...) then >> 8
const LIGHT_MAG       = Math.sqrt(LIGHT_X ** 2 + LIGHT_Y ** 2 + LIGHT_Z ** 2) | 0  // ≈ 71
const LIGHT_MAGNITUDE = (LIGHT_ATTENUATION * LIGHT_MAG) >> 8  // ≈ 213

// ── Colour helpers ────────────────────────────────────────────────────────────

function hsl24to16(hue, saturation, lightness) {
  hue        = hue        | 0
  saturation = saturation | 0
  lightness  = lightness  | 0
  if (lightness > 179) saturation = (saturation / 2) | 0
  if (lightness > 192) saturation = (saturation / 2) | 0
  if (lightness > 217) saturation = (saturation / 2) | 0
  if (lightness > 243) saturation = (saturation / 2) | 0
  return ((hue / 4) | 0) << 10 | ((saturation / 32) | 0) << 7 | (lightness / 2) | 0
}

export function mulHSL(hsl, lightness) {
  if (hsl === -1) return SKIP_COLOR
  lightness = (lightness * (hsl & 0x7F) / 128) | 0
  if (lightness < 2)   lightness = 2
  else if (lightness > 126) lightness = 126
  return (hsl & 0xFF80) + lightness
}

function adjustLightness(hsl, scalar) {
  if (hsl === -2) return SKIP_COLOR
  if (hsl === -1) {
    scalar = Math.max(0, Math.min(127, scalar | 0))
    return 127 - scalar
  }
  scalar = (scalar * (hsl & 0x7F) / 128) | 0
  if (scalar < 2)   scalar = 2
  else if (scalar > 126) scalar = 126
  return (hsl & 0xFF80) + scalar
}

// RGB integer → { hue, saturation, lightness, luminance, chroma, hsl } — mirrors FloType.setColor.
function hslFromRgb(rgb) {
  const r = ((rgb >> 16) & 0xFF) / 256
  const g = ((rgb >>  8) & 0xFF) / 256
  const b = ( rgb        & 0xFF) / 256

  const min = Math.min(r, g, b)
  const max = Math.max(r, g, b)
  const l   = (min + max) / 2

  let h = 0, s = 0
  if (min !== max) {
    s = l < 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min)
    if      (r === max) h = (g - b) / (max - min)
    else if (g === max) h = (b - r) / (max - min) + 2
    else                h = (r - g) / (max - min) + 4
  }
  h /= 6

  const hue        = (h * 256)   | 0
  const saturation = Math.min(255, Math.max(0, (s * 256) | 0))
  const lightness  = Math.min(255, Math.max(0, (l * 256) | 0))
  const luminance  = Math.max(1, l > 0.5
    ? (((1 - l) * s * 512) | 0)
    : ((l * s * 512) | 0))
  const chroma     = (h * luminance) | 0
  const hsl        = hsl24to16(hue, saturation, lightness)

  return { hue, saturation, lightness, luminance, chroma, hsl }
}

// ── FloType map ───────────────────────────────────────────────────────────────

// Build an array of FloType-like objects indexed by pack ID.
// floTypes[packId] = { rgb, texture, hue, saturation, lightness, luminance, chroma, hsl, isOverlay }
export function buildFloTypes(assetStore) {
  const floTypes = []

  for (const [packId, name] of assetStore.floPackMap) {
    let rgb = 0, texture = -1, isOverlay = false

    if (assetStore.overlayMap.has(name)) {
      const entry = assetStore.overlayMap.get(name)
      rgb       = entry.rgb ?? 0
      isOverlay = true
      if (entry.texture) {
        for (const [tid, tname] of assetStore.texturePackMap) {
          if (tname === entry.texture) { texture = tid; break }
        }
      }
    } else if (assetStore.underlayMap.has(name)) {
      rgb = assetStore.underlayMap.get(name)
    }

    floTypes[packId] = { rgb, texture, isOverlay, ...hslFromRgb(rgb) }
  }

  return floTypes
}

// ── Heightmap ─────────────────────────────────────────────────────────────────

function buildHeightmap(mapData, neighborMaps = {}) {
  const hm = []
  for (let level = 0; level < 4; level++) {
    hm[level] = []
    for (let x = 0; x <= MAX_TILES; x++) hm[level][x] = new Float32Array(MAX_TILES + 1)
    for (let x = 0; x < MAX_TILES; x++) {
      for (let z = 0; z < MAX_TILES; z++) {
        const tile = mapData.mapTiles[level]?.[x]?.[z]
        hm[level][x][z] = tile?.height ?? 0
      }
    }
    // Stitch east border column (x=64) from east neighbor's first column (x=0).
    if (neighborMaps.east) {
      for (let z = 0; z <= MAX_TILES; z++) {
        const tile = neighborMaps.east.mapTiles[level]?.[0]?.[z]
        hm[level][MAX_TILES][z] = tile?.height ?? 0
      }
    }
    // Stitch north border row (z=64) from north neighbor's first row (z=0).
    if (neighborMaps.north) {
      for (let x = 0; x <= MAX_TILES; x++) {
        const tile = neighborMaps.north.mapTiles[level]?.[x]?.[0]
        hm[level][x][MAX_TILES] = tile?.height ?? 0
      }
    }
    // Stitch northeast corner (64,64) from northeast neighbor's (0,0).
    if (neighborMaps.northeast) {
      const tile = neighborMaps.northeast.mapTiles[level]?.[0]?.[0]
      hm[level][MAX_TILES][MAX_TILES] = tile?.height ?? 0
    }
  }
  return hm
}

// ── Lightmap ──────────────────────────────────────────────────────────────────

function buildLightmap(heightmap, level) {
  const lm = []
  for (let x = 0; x <= MAX_TILES; x++) lm[x] = new Float32Array(MAX_TILES + 1).fill(LIGHT_AMBIENT)

  for (let z = 1; z < MAX_TILES; z++) {
    for (let x = 1; x < MAX_TILES; x++) {
      const dx  = heightmap[level][x + 1][z] - heightmap[level][x - 1][z]
      const dz  = heightmap[level][x][z + 1] - heightmap[level][x][z - 1]
      const len = Math.sqrt(dx * dx + dz * dz + 65536)

      const normalX = dx * 256 / len
      const normalY = 65536 / len
      const normalZ = dz * 256 / len
      lm[x][z] = LIGHT_AMBIENT + (LIGHT_X * normalX + LIGHT_Y * normalY + LIGHT_Z * normalZ) / LIGHT_MAGNITUDE
    }
  }
  return lm
}

// ── Tile geometry ─────────────────────────────────────────────────────────────

function buildTileGeometry(mapData, floTypes, heightmap, lightmap, level, out) {
  // Build tile data arrays for the blend accumulator (all 4 levels needed for completeness).
  const tileFlags    = makeGrid()
  const underlayIds  = makeGrid()
  const overlayIds   = makeGrid4()
  const overlayShape = makeGrid()
  const overlayRot   = makeGrid()

  for (let x = 0; x < MAX_TILES; x++) {
    for (let z = 0; z < MAX_TILES; z++) {
      const tile = mapData.mapTiles[level]?.[x]?.[z]
      if (!tile) continue
      tileFlags[x][z]    = tile.flag     ?? 0
      underlayIds[x][z]  = tile.underlay?.id ?? 0          // 1-indexed (0 = none)
      overlayIds[x][z]   = tile.overlay  != null ? tile.overlay.id : -1  // 0-indexed (-1 = none)
      overlayShape[x][z] = tile.shape    ?? 0
      overlayRot[x][z]   = tile.rotation ?? 0
    }
  }

  // Sliding-window blend accumulator — 11-tile-wide horizontal box filter.
  const blendChroma     = new Float32Array(MAX_TILES)
  const blendSaturation = new Float32Array(MAX_TILES)
  const blendLightness  = new Float32Array(MAX_TILES)
  const blendLuminance  = new Float32Array(MAX_TILES)
  const blendMagnitude  = new Float32Array(MAX_TILES)

  for (let x0 = -5; x0 < MAX_TILES + 5; x0++) {
    // Add column x0+5 to accumulators
    const x1 = x0 + 5
    if (x1 >= 0 && x1 < MAX_TILES) {
      for (let z0 = 0; z0 < MAX_TILES; z0++) {
        const uid = underlayIds[x1][z0]
        if (uid > 0 && floTypes[uid - 1]) {
          const flu = floTypes[uid - 1]
          blendChroma[z0]     += flu.chroma
          blendSaturation[z0] += flu.saturation
          blendLightness[z0]  += flu.lightness
          blendLuminance[z0]  += flu.luminance
          blendMagnitude[z0]++
        }
      }
    }

    // Remove column x0-5 from accumulators
    const x2 = x0 - 5
    if (x2 >= 0 && x2 < MAX_TILES) {
      for (let z0 = 0; z0 < MAX_TILES; z0++) {
        const uid = underlayIds[x2][z0]
        if (uid > 0 && floTypes[uid - 1]) {
          const flu = floTypes[uid - 1]
          blendChroma[z0]     -= flu.chroma
          blendSaturation[z0] -= flu.saturation
          blendLightness[z0]  -= flu.lightness
          blendLuminance[z0]  -= flu.luminance
          blendMagnitude[z0]--
        }
      }
    }

    if (x0 < 0 || x0 >= MAX_TILES) continue

    // Inner sliding window over Z for this X column
    let hueAcc = 0, satAcc = 0, ligAcc = 0, lumAcc = 0, magAcc = 0

    for (let z0 = -5; z0 < MAX_TILES + 5; z0++) {
      const dz1 = z0 + 5
      if (dz1 >= 0 && dz1 < MAX_TILES) {
        hueAcc += blendChroma[dz1]
        satAcc += blendSaturation[dz1]
        ligAcc += blendLightness[dz1]
        lumAcc += blendLuminance[dz1]
        magAcc += blendMagnitude[dz1]
      }
      const dz2 = z0 - 5
      if (dz2 >= 0 && dz2 < MAX_TILES) {
        hueAcc -= blendChroma[dz2]
        satAcc -= blendSaturation[dz2]
        ligAcc -= blendLightness[dz2]
        lumAcc -= blendLuminance[dz2]
        magAcc -= blendMagnitude[dz2]
      }

      if (z0 < 0 || z0 >= MAX_TILES) continue
      if (tileFlags[x0][z0] & 0x10) continue   // bridge/hidden tile flag

      const uid = underlayIds[x0][z0]
      const oid = overlayIds[x0][z0]

      if (uid === 0 && oid === -1) continue

      const hSW = heightmap[level][x0][z0]
      const hSE = heightmap[level][x0 + 1][z0]
      const hNE = heightmap[level][x0 + 1][z0 + 1]
      const hNW = heightmap[level][x0][z0 + 1]

      const lSW = lightmap[x0][z0]
      const lSE = lightmap[x0 + 1][z0]
      const lNE = lightmap[x0 + 1][z0 + 1]
      const lNW = lightmap[x0][z0 + 1]

      let baseColor = -1

      if (uid > 0 && magAcc > 0 && lumAcc > 0) {
        const hue        = (hueAcc * 256 / lumAcc) | 0
        const saturation = (satAcc / magAcc) | 0
        const lightness  = (ligAcc / magAcc) | 0
        baseColor = hsl24to16(hue, saturation, lightness)
      }

      if (oid === -1) {
        // Pure underlay tile (no overlay)
        if (baseColor === -1) continue
        emitUnderlayTile(
          x0, z0, level,
          hSW, hSE, hNE, hNW,
          mulHSL(baseColor, lSW), mulHSL(baseColor, lSE),
          mulHSL(baseColor, lNE), mulHSL(baseColor, lNW),
          out,
        )
      } else {
        // Overlay tile — shape=1..12
        const shape    = overlayShape[x0][z0] + 1
        const rotation = overlayRot[x0][z0]
        const flo      = floTypes[oid]

        if (!flo) continue

        let textureId = flo.texture
        let hsl

        if (textureId >= 0) {
          hsl = -1  // textured overlay; adjustLightness(-1, n) = 127-n (dim greyscale tint)
        } else if (flo.rgb === 0xFF00FF) {
          hsl = -2  // transparent/magenta → SKIP_COLOR on all secondary triangles
          textureId = -1
        } else {
          hsl = hsl24to16(flo.hue, flo.saturation, flo.lightness)
        }

        const cSW = mulHSL(baseColor, lSW)
        const cSE = mulHSL(baseColor, lSE)
        const cNE = mulHSL(baseColor, lNE)
        const cNW = mulHSL(baseColor, lNW)

        const oc1SW = adjustLightness(hsl, lSW)
        const oc1SE = adjustLightness(hsl, lSE)
        const oc1NE = adjustLightness(hsl, lNE)
        const oc1NW = adjustLightness(hsl, lNW)

        emitOverlayTile(
          x0, z0, level, shape, rotation, textureId,
          hSW, hSE, hNE, hNW,
          cSW, cSE, cNE, cNW,
          oc1SW, oc1SE, oc1NE, oc1NW,
          out,
        )
      }
    }
  }
}

// Two triangles for a flat underlay tile (equivalent to World3D.drawTileUnderlay).
function emitUnderlayTile(tileX, tileZ, level, hSW, hSE, hNE, hNW, cSW, cSE, cNE, cNW, out) {
  const ONE = 128
  const x0 = tileX * ONE,        z0 = tileZ * ONE
  const x1 = (tileX + 1) * ONE,  z1 = tileZ * ONE
  const x2 = (tileX + 1) * ONE,  z2 = (tileZ + 1) * ONE
  const x3 = tileX * ONE,        z3 = (tileZ + 1) * ONE

  out.push(new Triangle({
    tileX, tileZ, level, shape: 0, rotation: 0,
    vertices: [x2, hNE, z2, x3, hNW, z3, x1, hSE, z1],
    colors:   [cNE, cNW, cSE],
  }))
  out.push(new Triangle({
    tileX, tileZ, level, shape: 0, rotation: 0,
    vertices: [x0, hSW, z0, x1, hSE, z1, x3, hNW, z3],
    colors:   [cSW, cSE, cNW],
  }))
}

// Overlay tile triangles using TileOverlay shape tables.
function emitOverlayTile(
  tileX, tileZ, level, shape, rotation, textureId,
  hSW, hSE, hNE, hNW,
  cSW, cSE, cNE, cNW,
  oc1SW, oc1SE, oc1NE, oc1NW,
  out,
) {
  if (shape < 1 || shape > 12) return

  const ONE          = 128
  const HALF         = ONE / 2
  const QUARTER      = ONE / 4
  const THREE_QUARTER = ONE * 3 / 4
  const sceneX = tileX * ONE
  const sceneZ = tileZ * ONE

  const points       = SHAPE_POINTS[shape]
  const vertexCount  = points.length
  const vx = new Int32Array(vertexCount)
  const vy = new Int32Array(vertexCount)
  const vz = new Int32Array(vertexCount)
  const primary   = new Int32Array(vertexCount)
  const secondary = new Int32Array(vertexCount)

  for (let v = 0; v < vertexCount; v++) {
    let type = points[v]

    // Rotate even-numbered midpoint vertex types (types 2, 4, 6, 8, 10, 12, 14, 16).
    if ((type & 1) === 0 && type <= 8) {
      type = ((type - rotation - rotation - 1) & 7) + 1
    }
    if (type > 8 && type <= 12) {
      type = ((type - rotation - 9) & 3) + 9
    }
    if (type > 12 && type <= 16) {
      type = ((type - rotation - 13) & 3) + 13
    }

    let x, z, y, col1, col2
    switch (type) {
      case 1:  x = sceneX;               z = sceneZ;               y = hSW; col1 = cSW; col2 = oc1SW; break
      case 2:  x = sceneX + HALF;        z = sceneZ;               y = (hSW + hSE) >> 1; col1 = (cSW + cSE) >> 1; col2 = (oc1SW + oc1SE) >> 1; break
      case 3:  x = sceneX + ONE;         z = sceneZ;               y = hSE; col1 = cSE; col2 = oc1SE; break
      case 4:  x = sceneX + ONE;         z = sceneZ + HALF;        y = (hSE + hNE) >> 1; col1 = (cSE + cNE) >> 1; col2 = (oc1SE + oc1NE) >> 1; break
      case 5:  x = sceneX + ONE;         z = sceneZ + ONE;         y = hNE; col1 = cNE; col2 = oc1NE; break
      case 6:  x = sceneX + HALF;        z = sceneZ + ONE;         y = (hNE + hNW) >> 1; col1 = (cNE + cNW) >> 1; col2 = (oc1NE + oc1NW) >> 1; break
      case 7:  x = sceneX;               z = sceneZ + ONE;         y = hNW; col1 = cNW; col2 = oc1NW; break
      case 8:  x = sceneX;               z = sceneZ + HALF;        y = (hNW + hSW) >> 1; col1 = (cNW + cSW) >> 1; col2 = (oc1NW + oc1SW) >> 1; break
      case 9:  x = sceneX + HALF;        z = sceneZ + QUARTER;     y = (hSW + hSE) >> 1; col1 = (cSW + cSE) >> 1; col2 = (oc1SW + oc1SE) >> 1; break
      case 10: x = sceneX + THREE_QUARTER; z = sceneZ + HALF;      y = (hSE + hNE) >> 1; col1 = (cSE + cNE) >> 1; col2 = (oc1SE + oc1NE) >> 1; break
      case 11: x = sceneX + HALF;        z = sceneZ + THREE_QUARTER; y = (hNE + hNW) >> 1; col1 = (cNE + cNW) >> 1; col2 = (oc1NE + oc1NW) >> 1; break
      case 12: x = sceneX + QUARTER;     z = sceneZ + HALF;        y = (hNW + hSW) >> 1; col1 = (cNW + cSW) >> 1; col2 = (oc1NW + oc1SW) >> 1; break
      case 13: x = sceneX + QUARTER;     z = sceneZ + QUARTER;     y = hSW; col1 = cSW; col2 = oc1SW; break
      case 14: x = sceneX + THREE_QUARTER; z = sceneZ + QUARTER;   y = hSE; col1 = cSE; col2 = oc1SE; break
      case 15: x = sceneX + THREE_QUARTER; z = sceneZ + THREE_QUARTER; y = hNE; col1 = cNE; col2 = oc1NE; break
      default: x = sceneX + QUARTER;     z = sceneZ + THREE_QUARTER; y = hNW; col1 = cNW; col2 = oc1NW; break
    }

    vx[v] = x; vy[v] = y; vz[v] = z
    primary[v]   = col1
    secondary[v] = col2
  }

  // World-space UV coordinates: U = worldX / 128, V = worldZ / 128.
  // gl.REPEAT wraps integer UV values, giving one texture repeat per tile.
  const uvX = new Float32Array(vertexCount)
  const uvZ = new Float32Array(vertexCount)
  for (let v = 0; v < vertexCount; v++) {
    uvX[v] = vx[v] / ONE
    uvZ[v] = vz[v] / ONE
  }

  const paths = SHAPE_PATHS[shape]
  const triCount = (paths.length / 4) | 0

  for (let t = 0; t < triCount; t++) {
    const colorFlag = paths[t * 4]
    let a = paths[t * 4 + 1]
    let b = paths[t * 4 + 2]
    let c = paths[t * 4 + 3]

    // Rotate corner vertex indices (< 4)
    if (a < 4) a = (a - rotation) & 3
    if (b < 4) b = (b - rotation) & 3
    if (c < 4) c = (c - rotation) & 3

    const colors = colorFlag === 0
      ? [primary[a],   primary[b],   primary[c]]
      : [secondary[a], secondary[b], secondary[c]]

    // Only overlay triangles (colorFlag=1) get the texture
    const triTexId = colorFlag === 1 ? textureId : -1

    out.push(new Triangle({
      tileX, tileZ, level, shape, rotation,
      vertices: [vx[a], vy[a], vz[a], vx[b], vy[b], vz[b], vx[c], vy[c], vz[c]],
      colors,
      textureId: triTexId,
      textureCoordinates: triTexId >= 0 ? [uvX[a], uvZ[a], uvX[b], uvZ[b], uvX[c], uvZ[c]] : null,
    }))
  }
}

// ── Entity geometry (Locs, NPCs, Objs) ────────────────────────────────────────

function buildEntityGeometry(mapData, assetStore, heightmap, level, out, options = {}) {
  const showLocs = options.showLocs !== false
  const showNpcs = options.showNpcs !== false
  const showObjs = options.showObjs !== false

  if (showLocs && mapData.locations) {
    for (const loc of mapData.locations) {
      if (loc.level !== level) continue
      addLoc(loc, assetStore, heightmap, level, out)
    }
  }
  if (showNpcs && mapData.npcs) {
    for (const npc of mapData.npcs) {
      if (npc.level !== level) continue
      addNpc(npc, assetStore, heightmap, level, out)
    }
  }
  if (showObjs && mapData.objects) {
    for (const obj of mapData.objects) {
      if (obj.level !== level) continue
      addObj(obj, assetStore, heightmap, level, out)
    }
  }
}

function addLoc(loc, assetStore, heightmap, level, out) {
  const locName = assetStore.locPackMap.get(loc.id)
  if (!locName) return

  const locData = assetStore.allLocMap.get(locName)
  const modelBase = locData?.model ?? locName

  const shape    = loc.shape    ?? 0
  const rotation = loc.rotation ?? 0

  // Resolve model ID — try shape suffix first, then bare name, then all suffixes.
  let modelId = null
  const shapeSuffix = SHAPE_SUFFIX_MAP.get(shape)
  if (shapeSuffix) modelId = assetStore.modelPackMap.get(modelBase + shapeSuffix)
  if (modelId == null) modelId = assetStore.modelPackMap.get(modelBase)
  if (modelId == null) {
    for (const suf of SUFFIXES) {
      const candidate = assetStore.modelPackMap.get(modelBase + suf)
      if (candidate != null) { modelId = candidate; break }
    }
  }
  if (modelId == null) return

  const model = assetStore.modelOb2Map.get(modelId)
  if (!model || model.faceCount === 0) return

  const hSW = heightmap[level][loc.x][loc.z]
  const hSE = heightmap[level][loc.x + 1]?.[loc.z]   ?? hSW
  const hNE = heightmap[level][loc.x + 1]?.[loc.z + 1] ?? hSW
  const hNW = heightmap[level][loc.x]?.[loc.z + 1]   ?? hSW
  const y   = (hSW + hSE + hNE + hNW) >> 2

  const width  = locData?.width  ?? 1
  const length = locData?.length ?? 1
  const sceneX = loc.x * 128 + width  * 64
  const sceneZ = loc.z * 128 + length * 64

  const resizex = locData?.resizex ?? 128
  const resizey = locData?.resizey ?? 128
  const resizez = locData?.resizez ?? 128
  const offsetx = locData?.offsetx ?? 0
  const offsety = locData?.offsety ?? 0
  const offsetz = locData?.offsetz ?? 0

  // yaw for diagonal centrepiece; wall decorations add their own yaw elsewhere.
  const yaw = shape === LOC_CENTREPIECE_DIAGONAL ? 256 : 0

  emitModelTriangles(model, rotation, sceneX, y, sceneZ, yaw,
    resizex, resizey, resizez, offsetx, offsety, offsetz,
    loc.x, loc.z, level, out)
}

function addNpc(npc, assetStore, heightmap, level, out) {
  const npcName = assetStore.npcPackMap.get(npc.id)
  if (!npcName) return
  const npcData = assetStore.allNpcMap.get(npcName)
  if (!npcData?.models?.length) return

  const height = heightmap[level][npc.x]?.[npc.z] ?? 0
  const sceneX = npc.x * 128 + 64
  const sceneZ = npc.z * 128 + 64

  const resizeh = npcData.resizeh ?? 128
  const resizev = npcData.resizev ?? 128

  for (const modelName of npcData.models) {
    const modelId = assetStore.modelPackMap.get(modelName)
    if (modelId == null) continue
    const model = assetStore.modelOb2Map.get(modelId)
    if (!model || model.faceCount === 0) continue
    emitModelTriangles(model, 0, sceneX, height, sceneZ, 0,
      resizeh, resizev, resizeh, 0, 0, 0,
      npc.x, npc.z, level, out)
  }
}

function addObj(obj, assetStore, heightmap, level, out) {
  const objName = assetStore.objPackMap.get(obj.id)
  if (!objName) return
  const objData = assetStore.allObjMap.get(objName)

  let modelName = ''
  if (objName.startsWith('cert_')) {
    modelName = 'model_2429_obj'
  } else if (objData?.model) {
    modelName = objData.model
  }
  if (!modelName) return

  const modelId = assetStore.modelPackMap.get(modelName)
  if (modelId == null) return
  const model = assetStore.modelOb2Map.get(modelId)
  if (!model || model.faceCount === 0) return

  const height = heightmap[level][obj.x]?.[obj.z] ?? 0
  const sceneX = obj.x * 128 + 64
  const sceneZ = obj.z * 128 + 64

  emitModelTriangles(model, 0, sceneX, height, sceneZ, 0,
    128, 128, 128, 0, 0, 0,
    obj.x, obj.z, level, out)
}

// Compute UV for all three vertices of a model face using the P/M/N reference-plane method.
// Matches Model.calculateTextureCoordinates() in Java exactly:
// P is the UV origin (0,0); M endpoint defines the U axis; N endpoint defines the V axis.
// Uses the dual-basis (oblique projection) method via cross products, which correctly handles
// non-orthogonal P→M / P→N configurations (e.g. skewed wall faces).
function computeModelFaceUV(vx, vy, vz, pIdx, mIdx, nIdx, ia, ib, ic) {
  const pX = vx[pIdx], pY = vy[pIdx], pZ = vz[pIdx]

  // P→M and P→N
  const f882 = vx[mIdx] - pX, f883 = vy[mIdx] - pY, f884 = vz[mIdx] - pZ
  const f885 = vx[nIdx] - pX, f886 = vy[nIdx] - pY, f887 = vz[nIdx] - pZ

  // Face-vertex offsets from P
  const ax = vx[ia] - pX, ay = vy[ia] - pY, az = vz[ia] - pZ
  const bx = vx[ib] - pX, by = vy[ib] - pY, bz = vz[ib] - pZ
  const cx = vx[ic] - pX, cy = vy[ic] - pY, cz = vz[ic] - pZ

  // Normal = (P→M) × (P→N)
  const f897 = f883 * f887 - f884 * f886
  const f898 = f884 * f885 - f882 * f887
  const f899 = f882 * f886 - f883 * f885

  // U dual basis = (P→N) × normal; normalised so dot(dual_U, P→M) = 1
  let f900 = f886 * f899 - f887 * f898
  let f901 = f887 * f897 - f885 * f899
  let f902 = f885 * f898 - f886 * f897
  let denom = f900 * f882 + f901 * f883 + f902 * f884
  if (denom === 0) return [0, 0, 0, 0, 0, 0]
  let inv = 1.0 / denom
  const ua = (f900 * ax + f901 * ay + f902 * az) * inv
  const ub = (f900 * bx + f901 * by + f902 * bz) * inv
  const uc = (f900 * cx + f901 * cy + f902 * cz) * inv

  // V dual basis = (P→M) × normal; normalised so dot(dual_V, P→N) = 1
  f900 = f883 * f899 - f884 * f898
  f901 = f884 * f897 - f882 * f899
  f902 = f882 * f898 - f883 * f897
  denom = f900 * f885 + f901 * f886 + f902 * f887
  if (denom === 0) return [ua, 0, ub, 0, uc, 0]
  inv = 1.0 / denom
  const va = (f900 * ax + f901 * ay + f902 * az) * inv
  const vb = (f900 * bx + f901 * by + f902 * bz) * inv
  const vc = (f900 * cx + f901 * cy + f902 * cz) * inv

  return [ua, va, ub, vb, uc, vc]
}

// Emit one Triangle per face of a model, applying rotation, scale, offset, and yaw.
function emitModelTriangles(
  model, rotation, px, py, pz, yaw,
  resizex, resizey, resizez, offsetx, offsety, offsetz,
  tileX, tileZ, level, out,
) {
  const vc = model.vertexCount
  const vx = new Float32Array(vc)
  const vy = new Float32Array(vc)
  const vz = new Float32Array(vc)

  for (let i = 0; i < vc; i++) {
    let x = model.verticesX[i]
    let y = model.verticesY[i]
    let z = model.verticesZ[i]

    // Apply discrete 90° Y rotations (same axis convention as Java rotateY90).
    for (let r = 0; r < rotation; r++) {
      const tmp = x; x = z; z = -tmp
    }

    // Scale
    if (resizex !== 128 || resizey !== 128 || resizez !== 128) {
      x = (x * resizex) >> 7
      y = (y * resizey) >> 7
      z = (z * resizez) >> 7
    }

    // Offset
    x += offsetx
    y += offsety
    z += offsetz

    // Additional yaw rotation (CENTREPIECE_DIAGONAL, wall decorations).
    if (yaw !== 0) {
      const angle  = yaw * Math.PI / 1024
      const cosA   = Math.cos(angle)
      const sinA   = Math.sin(angle)
      const rx     = x * cosA - z * sinA
      const rz     = x * sinA + z * cosA
      x = rx; z = rz
    }

    // Translate to world position
    vx[i] = px + x
    vy[i] = py + y
    vz[i] = pz + z
  }

  // Simple flat lighting using face normals
  const lightDirX = LIGHT_X / LIGHT_MAG
  const lightDirY = LIGHT_Y / LIGHT_MAG
  const lightDirZ = LIGHT_Z / LIGHT_MAG

  for (let f = 0; f < model.faceCount; f++) {
    // Skip faces marked hidden (faceInfo byte 0xFF = 255, Java -1 signed byte)
    if (model.faceInfos?.[f] === 255) continue
    // Skip fully-transparent faces
    if (model.faceAlphas?.[f] === 255) continue

    const ia = model.faceIndicesA[f]
    const ib = model.faceIndicesB[f]
    const ic = model.faceIndicesC[f]

    const ax = vx[ia], ay = vy[ia], az = vz[ia]
    const bx = vx[ib], by = vy[ib], bz = vz[ib]
    const cx = vx[ic], cy = vy[ic], cz = vz[ic]

    // Face normal via cross product (AB × AC)
    const abx = bx - ax, aby = by - ay, abz = bz - az
    const acx = cx - ax, acy = cy - ay, acz = cz - az
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz)

    let lightValue = LIGHT_AMBIENT
    if (nlen > 0) {
      // Flat shading: dot product of face normal with light direction.
      // Scaled to match the lightmap range (roughly 50-130) so mulHSL produces good results.
      const dot = (nx / nlen) * lightDirX + (ny / nlen) * lightDirY + (nz / nlen) * lightDirZ
      lightValue = Math.max(10, Math.min(126, (LIGHT_AMBIENT + dot * 60) | 0))
    }

    // For textured faces the color slot holds the texture ID, not an HSL value.
    // Use a neutral mid-grey (hsl=127) so the hover tint still works correctly.
    const tcIdx  = model.textureCoords?.[f] ?? -1
    const texId  = tcIdx >= 0 ? (model.faceTextures?.[f] ?? -1) : -1
    const rawHsl = tcIdx >= 0 ? 127 : model.faceColors[f]
    const hslColor = mulHSL(rawHsl, lightValue)

    // UV coordinates from the P/M/N reference plane (only for textured faces).
    let texCoords = null
    if (tcIdx >= 0 && texId >= 0) {
      const pIdx = model.texturePCoordinate[tcIdx]
      const mIdx = model.textureMCoordinate[tcIdx]
      const nIdx = model.textureNCoordinate[tcIdx]
      texCoords = computeModelFaceUV(vx, vy, vz, pIdx, mIdx, nIdx, ia, ib, ic)
    }

    out.push(new Triangle({
      isModel: true,
      tileX, tileZ, level,
      shape: 0, rotation: 0,
      vertices: [ax, ay, az, bx, by, bz, cx, cy, cz],
      colors:   [hslColor, hslColor, hslColor],
      textureId: texId,
      textureCoordinates: texCoords,
    }))
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export class WorldBuilder {
  constructor() {
    this._floTypes = null
  }

  // Call after assetStore is populated to pre-compute FloType data.
  initFloTypes(assetStore) {
    this._floTypes = buildFloTypes(assetStore)
  }

  get floTypes() { return this._floTypes }

  // Converts MapData → Triangle[] for the given display level.
  // Pass level = -1 to render all four levels simultaneously.
  // options: { showLocs, showNpcs, showObjs } — all default true.
  buildGeometry(mapData, assetStore, level, options = {}, neighborMaps = {}) {
    if (!this._floTypes) this.initFloTypes(assetStore)

    const heightmap = buildHeightmap(mapData, neighborMaps)
    const triangles = []
    const levels    = level === -1 ? [0, 1, 2, 3] : [level]

    for (const lv of levels) {
      const before   = triangles.length
      const lightmap = buildLightmap(heightmap, lv)
      buildTileGeometry(mapData, this._floTypes, heightmap, lightmap, lv, triangles)
      buildEntityGeometry(mapData, assetStore, heightmap, lv, triangles, options)
      if (levels.length > 1) console.log(`[WorldBuilder] level ${lv}: ${triangles.length - before} triangles`)
    }

    return triangles
  }
}

export const worldBuilder = new WorldBuilder()

// Resolves the first model ID for a clicked entity. Used by ModelViewer (T10).
export function resolveEntityModelId(type, entity, assetStore) {
  if (type === 'loc') {
    const locName = assetStore.locPackMap.get(entity.id)
    if (!locName) return null
    const locData   = assetStore.allLocMap.get(locName)
    const modelBase = locData?.model ?? locName
    const shapeSuffix = SHAPE_SUFFIX_MAP.get(entity.shape ?? 0)
    let modelId = null
    if (shapeSuffix) modelId = assetStore.modelPackMap.get(modelBase + shapeSuffix) ?? null
    if (modelId == null) modelId = assetStore.modelPackMap.get(modelBase) ?? null
    if (modelId == null) {
      for (const suf of SUFFIXES) {
        const c = assetStore.modelPackMap.get(modelBase + suf)
        if (c != null) { modelId = c; break }
      }
    }
    return modelId
  }
  if (type === 'npc') {
    const npcName = assetStore.npcPackMap.get(entity.id)
    if (!npcName) return null
    const npcData = assetStore.allNpcMap.get(npcName)
    if (!npcData?.models?.length) return null
    return assetStore.modelPackMap.get(npcData.models[0]) ?? null
  }
  if (type === 'obj') {
    const objName = assetStore.objPackMap.get(entity.id)
    if (!objName) return null
    const objData = assetStore.allObjMap.get(objName)
    const modelName = objName.startsWith('cert_') ? 'model_2429_obj' : (objData?.model ?? '')
    if (!modelName) return null
    return assetStore.modelPackMap.get(modelName) ?? null
  }
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGrid() {
  return Array.from({ length: MAX_TILES }, () => new Int32Array(MAX_TILES))
}

function makeGrid4() {
  return Array.from({ length: MAX_TILES }, () => new Int32Array(MAX_TILES).fill(-1))
}
