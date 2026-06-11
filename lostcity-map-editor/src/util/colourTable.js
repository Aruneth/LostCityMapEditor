// Port of Pix3D.setBrightness() — builds the 65536-entry HSL→RGB lookup table
// used by the game engine to convert packed colour indices to display RGB values.

function setGamma(rgb, gamma) {
  const r = Math.pow(((rgb >> 16) & 0xFF) / 256.0, gamma)
  const g = Math.pow(((rgb >>  8) & 0xFF) / 256.0, gamma)
  const b = Math.pow(( rgb        & 0xFF) / 256.0, gamma)
  return ((r * 256 | 0) << 16) | ((g * 256 | 0) << 8) | (b * 256 | 0)
}

function hslChannel(p, q, h) {
  if (h * 6.0 < 1.0) return p + (q - p) * 6.0 * h
  if (h * 2.0 < 1.0) return q
  if (h * 3.0 < 2.0) return p + (q - p) * (0.6666666666666666 - h) * 6.0
  return p
}

export function buildColourTable(brightness = 0.6) {
  // Java adds a small random offset to brightness — we keep that for authenticity.
  const gamma  = brightness + Math.random() * 0.03 - 0.015
  const table  = new Int32Array(65536)
  let   offset = 0

  for (let y = 0; y < 512; y++) {
    const hue        = ((y / 8) | 0) / 64.0 + 0.0078125
    const saturation = (y & 7)       / 8.0  + 0.0625

    for (let x = 0; x < 128; x++) {
      const lightness = x / 128.0
      let r = lightness, g = lightness, b = lightness

      if (saturation !== 0.0) {
        const q = lightness < 0.5
          ? lightness * (saturation + 1.0)
          : lightness + saturation - lightness * saturation
        const p = lightness * 2.0 - q

        let t   = hue + 0.3333333333333333; if (t   > 1.0) t--
        let d11 = hue - 0.3333333333333333; if (d11 < 0.0) d11++

        r = hslChannel(p, q, t)
        g = hslChannel(p, q, hue)
        b = hslChannel(p, q, d11)
      }

      const rgb = ((r * 256 | 0) << 16) | ((g * 256 | 0) << 8) | (b * 256 | 0)
      table[offset++] = setGamma(rgb, gamma)
    }
  }

  return table
}

// Singleton — built once at module load with default brightness.
export const colourTable = buildColourTable(0.6)
