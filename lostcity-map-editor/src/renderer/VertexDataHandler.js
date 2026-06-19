import { colourTable } from '../util/colourTable.js'

// Floats per vertex — must match ShaderManager attribute layout.
//   aPos(3) + aColor(3) + aTexCoord(2) + aUseTexture(1) + aTileXZ(1) = 10
const STRIDE       = 10
const STRIDE_BYTES = STRIDE * 4   // Float32 = 4 bytes

// Default UV coordinates used when a triangle has a texture but no explicit UVs.
const DEFAULT_UV = [
  0.0, 0.0,
  1.0, 0.0,
  0.0, 1.0,
]

// Packs an array of Triangle objects into interleaved GPU vertex data.
// Triangles are grouped by textureId; each group gets its own VAO + VBO.
// Returns Map<textureId, { vao, vbo, count }> stored in scene.vaoGroups.
// glTexture is populated later by TextureManager (T07).
export function uploadTriangles(gl, triangles) {
  // Destroy any previous VAOs/VBOs first (scene rebuild).
  // Caller is responsible for calling destroyVaoGroups() before this.

  // Group triangle objects by textureId.
  const groups = new Map()
  for (const tri of triangles) {
    if (!tri.isVisible()) continue
    const key = tri.textureId
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(tri)
  }

  const result = new Map()

  for (const [texId, tris] of groups) {
    const vertexCount   = tris.length * 3
    const data          = new Float32Array(vertexCount * STRIDE)
    let   di            = 0

    for (const tri of tris) {
      for (let v = 0; v < 3; v++) {
        // Position
        data[di++] = tri.vertices[v * 3]
        data[di++] = tri.vertices[v * 3 + 1]
        data[di++] = tri.vertices[v * 3 + 2]

        // Color — rawColor bypasses colourTable; otherwise look up packed HSL-16.
        if (tri.rawColor) {
          data[di++] = tri.rawColor[0]
          data[di++] = tri.rawColor[1]
          data[di++] = tri.rawColor[2]
        } else if (tri.colors != null) {
          const hsl = tri.colors[v]
          const rgb = (hsl >= 0 && hsl < colourTable.length) ? colourTable[hsl] : 0
          data[di++] = ((rgb >> 16) & 0xFF) / 255.0
          data[di++] = ((rgb >>  8) & 0xFF) / 255.0
          data[di++] = ( rgb        & 0xFF) / 255.0
        } else {
          data[di++] = 1.0; data[di++] = 0.5; data[di++] = 0.2  // orange fallback
        }

        // Texture UV
        const hasUV = tri.textureId > -1 && tri.textureCoordinates != null
        const hasTex = tri.textureId > -1
        if (hasUV) {
          data[di++] = tri.textureCoordinates[v * 2]
          data[di++] = tri.textureCoordinates[v * 2 + 1]
        } else if (hasTex) {
          data[di++] = DEFAULT_UV[v * 2]
          data[di++] = DEFAULT_UV[v * 2 + 1]
        } else {
          data[di++] = 0.0; data[di++] = 0.0
        }

        // useTexture flag
        data[di++] = hasTex ? 1.0 : 0.0

        // aTileXZ — packed tile address; multiplier 1024 avoids collisions for world coords up to 1023.
        data[di++] = tri.tileX * 1024 + tri.tileZ
      }
    }

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)

    // aPos
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE_BYTES, 0)
    gl.enableVertexAttribArray(0)
    // aColor
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE_BYTES, 3 * 4)
    gl.enableVertexAttribArray(1)
    // aTexCoord
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE_BYTES, 6 * 4)
    gl.enableVertexAttribArray(2)
    // aUseTexture
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE_BYTES, 8 * 4)
    gl.enableVertexAttribArray(3)
    // aIsHovered
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, STRIDE_BYTES, 9 * 4)
    gl.enableVertexAttribArray(4)

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    result.set(texId, { vao, vbo, count: vertexCount, glTexture: null })
  }

  return result
}

// Deletes all GPU resources for a vaoGroups Map.
// Call before uploadTriangles() when rebuilding the scene.
export function destroyVaoGroups(gl, vaoGroups) {
  for (const { vao, vbo } of vaoGroups.values()) {
    if (vao) gl.deleteVertexArray(vao)
    if (vbo) gl.deleteBuffer(vbo)
  }
  vaoGroups.clear()
}
