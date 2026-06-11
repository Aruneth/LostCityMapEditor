import { assetStore } from '../loaders/AssetStore.js'

// Replaces magenta (255, 0, 255) pixels with fully transparent — matches Java TextureLoader.
function replaceMagenta(data) {
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 255) {
      out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0
    } else {
      out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2]; out[i + 3] = data[i + 3]
    }
  }
  return out
}

async function loadOneTexture(gl, dirPath, textureName) {
  const fileName = textureName.endsWith('.png') ? textureName : textureName + '.png'
  const fullPath = `${dirPath}/textures/${fileName}`

  try {
    const buf    = await window.electronAPI.readFile(fullPath)
    const blob   = new Blob([new Uint8Array(buf)], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)

    // Use a temporary <canvas> to extract RGBA pixels for magenta removal.
    const tmp = document.createElement('canvas')
    tmp.width  = bitmap.width
    tmp.height = bitmap.height
    const ctx  = tmp.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    const pixels    = replaceMagenta(imageData.data)

    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bitmap.width, bitmap.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.bindTexture(gl.TEXTURE_2D, null)

    return tex
  } catch (e) {
    console.warn('[TextureManager] failed to load texture:', textureName, e.message)
    return null
  }
}

// Populates glTexture entries in vaoGroups from assetStore.texturePackMap.
// vaoGroups: Map<texId, { vao, vbo, count, glTexture }> — modified in-place.
// Call this from the glQueue after uploadTriangles() completes.
export async function loadTextures(gl, vaoGroups) {
  const { texturePackMap, serverDir } = assetStore
  if (!serverDir || texturePackMap.size === 0) return

  // texId → WebGLTexture — reuses the same GPU texture if multiple vaoGroups share an id.
  const texCache = new Map()

  for (const [texId, group] of vaoGroups) {
    if (texId < 0) continue   // untextured group — no PNG to load
    if (texCache.has(texId)) {
      group.glTexture = texCache.get(texId)
      continue
    }
    const textureName = texturePackMap.get(texId)
    if (!textureName) continue
    const tex = await loadOneTexture(gl, serverDir, textureName)
    if (tex) {
      group.glTexture = tex
      texCache.set(texId, tex)
    }
  }
}

// Frees all WebGL textures whose IDs are stored in vaoGroups.
// Call before destroying/rebuilding the scene.
export function destroyTextures(gl, vaoGroups) {
  const seen = new Set()
  for (const group of vaoGroups.values()) {
    if (group.glTexture && !seen.has(group.glTexture)) {
      gl.deleteTexture(group.glTexture)
      seen.add(group.glTexture)
      group.glTexture = null
    }
  }
}
