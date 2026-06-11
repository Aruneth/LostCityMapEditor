// Port of World.perlinNoise() + helpers from World.java.
// Used by MapDataTransformer to generate default heights for level-0 tiles.

// Pre-computed cosine lookup table — mirrors Pix3D.cosTable in Java.
const cosTable = new Int32Array(2048)
for (let i = 0; i < 2048; i++) {
  cosTable[i] = Math.cos(i * 0.0030679615) * 65536 | 0
}

function noise(x, y) {
  let n = x + y * 57
  let n1 = (n << 13) ^ n
  // Java's int overflow is replicated with | 0 and >>> 0.
  let result = (((n1 * ((n1 * n1 * 15731 + 789221) | 0) | 0) + 1376312589) | 0) & 0x7FFFFFFF
  return (result >> 19) & 0xFF
}

function smoothNoise(x, y) {
  const corners = noise(x - 1, y - 1) + noise(x + 1, y - 1) + noise(x - 1, y + 1) + noise(x + 1, y + 1)
  const sides   = noise(x - 1, y) + noise(x + 1, y) + noise(x, y - 1) + noise(x, y + 1)
  const center  = noise(x, y)
  return Math.floor(corners / 16) + Math.floor(sides / 8) + Math.floor(center / 4)
}

function interpolate(a, b, x, scale) {
  const f = (65536 - cosTable[(x * 1024 / scale) | 0]) >> 1
  return ((a * (65536 - f)) >> 16) + ((b * f) >> 16)
}

function perlinScale(x, z, scale) {
  const intX  = (x / scale) | 0
  const fracX = x & (scale - 1)
  const intZ  = (z / scale) | 0
  const fracZ = z & (scale - 1)
  const v1 = smoothNoise(intX,     intZ)
  const v2 = smoothNoise(intX + 1, intZ)
  const v3 = smoothNoise(intX,     intZ + 1)
  const v4 = smoothNoise(intX + 1, intZ + 1)
  const i1 = interpolate(v1, v2, fracX, scale)
  const i2 = interpolate(v3, v4, fracX, scale)
  return interpolate(i1, i2, fracZ, scale)
}

export function perlinNoise(x, z) {
  let value = perlinScale(x + 45365, z + 91923, 4)
            + ((perlinScale(x + 10294, z + 37821, 2) - 128) >> 1)
            + ((perlinScale(x, z, 1) - 128) >> 2)
            - 128
  value = Math.floor(value * 0.3) + 35
  if (value < 10) return 10
  if (value > 60) return 60
  return value
}
