import { mat4 } from 'gl-matrix'
import { ShaderManager } from './ShaderManager.js'
import { uploadTriangles, destroyVaoGroups } from './VertexDataHandler.js'
import { Triangle } from '../data/Triangle.js'
import { mulHSL } from './WorldBuilder.js'

const LIGHT_AMBIENT = 96
const LIGHT_X = -50, LIGHT_Y = -10, LIGHT_Z = -50
const LIGHT_MAG = Math.sqrt(LIGHT_X ** 2 + LIGHT_Y ** 2 + LIGHT_Z ** 2) | 0

export class ModelViewer {
  constructor(canvas) {
    this._canvas = canvas

    const gl = canvas.getContext('webgl2')
    if (!gl) { console.warn('ModelViewer: WebGL2 not available'); return }
    this._gl = gl

    this._shaderManager = new ShaderManager()
    this._shaderManager.createProgram(gl)

    this._vaoGroups = new Map()
    this._yaw       = 0
    this._center    = [0, 0, 0]
    this._radius    = 100
    this._active    = false

    gl.clearColor(0.12, 0.12, 0.12, 1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.viewport(0, 0, canvas.width, canvas.height)

    this._loop()
  }

  // Render a model by its numeric pack ID. Pass null to clear.
  showModel(modelId, assetStore) {
    const model = assetStore.modelOb2Map.get(modelId)
    if (!model || model.faceCount === 0) { this.clear(); return }

    const triangles = this._buildTriangles(model)
    if (triangles.length === 0) { this.clear(); return }

    this._computeCenter(triangles)

    const gl = this._gl
    destroyVaoGroups(gl, this._vaoGroups)
    this._vaoGroups = uploadTriangles(gl, triangles)
    this._active    = true
  }

  clear() {
    if (this._gl) destroyVaoGroups(this._gl, this._vaoGroups)
    this._active = false
  }

  // Builds flat-shaded Triangle[] from a raw ob2 model, centered at raw origin.
  // Textures are stripped — the preview shows vertex colors only.
  _buildTriangles(model) {
    const vc = model.vertexCount
    const vx = new Float32Array(vc)
    const vy = new Float32Array(vc)
    const vz = new Float32Array(vc)

    for (let i = 0; i < vc; i++) {
      vx[i] = model.verticesX[i]
      vy[i] = model.verticesY[i]
      vz[i] = model.verticesZ[i]
    }

    const ldx = LIGHT_X / LIGHT_MAG
    const ldy = LIGHT_Y / LIGHT_MAG
    const ldz = LIGHT_Z / LIGHT_MAG
    const out = []

    for (let f = 0; f < model.faceCount; f++) {
      if (model.faceInfos?.[f] === -1) continue
      if (model.faceAlphas?.[f] === 255) continue

      const ia = model.faceIndicesA[f]
      const ib = model.faceIndicesB[f]
      const ic = model.faceIndicesC[f]

      const ax = vx[ia], ay = vy[ia], az = vz[ia]
      const bx = vx[ib], by = vy[ib], bz = vz[ib]
      const cx = vx[ic], cy = vy[ic], cz = vz[ic]

      const abx = bx - ax, aby = by - ay, abz = bz - az
      const acx = cx - ax, acy = cy - ay, acz = cz - az
      const nx = aby * acz - abz * acy
      const ny = abz * acx - abx * acz
      const nz = abx * acy - aby * acx
      const nl = Math.sqrt(nx*nx + ny*ny + nz*nz)

      let lightValue = LIGHT_AMBIENT
      if (nl > 0) {
        const dot = (nx/nl)*ldx + (ny/nl)*ldy + (nz/nl)*ldz
        lightValue = Math.max(10, Math.min(126, (LIGHT_AMBIENT + dot * 60) | 0))
      }

      const color = mulHSL(model.faceColors[f], lightValue)

      out.push(new Triangle({
        isModel: true,
        tileX: 0, tileZ: 0, level: 0, shape: 0, rotation: 0,
        vertices: [ax, ay, az, bx, by, bz, cx, cy, cz],
        colors:   [color, color, color],
        textureId: -1,
      }))
    }

    return out
  }

  // Computes the bounding-box center and half-size of a triangle array.
  _computeCenter(triangles) {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity

    for (const tri of triangles) {
      for (let v = 0; v < 3; v++) {
        const x = tri.vertices[v * 3]
        const y = tri.vertices[v * 3 + 1]
        const z = tri.vertices[v * 3 + 2]
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
      }
    }

    this._center = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
    const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ
    this._radius = Math.max(dx, dy, dz, 10) / 2
  }

  _loop() {
    requestAnimationFrame(() => this._loop())

    const { _gl: gl, _shaderManager: sm } = this
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    if (!this._active || this._vaoGroups.size === 0) return

    this._yaw += 0.5 * (Math.PI / 180)

    gl.useProgram(sm.program)
    this._uploadUniforms(gl, sm.uniforms)

    for (const [, { vao, count }] of this._vaoGroups) {
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLES, 0, count)
    }

    gl.bindVertexArray(null)
  }

  _uploadUniforms(gl, uniforms) {
    const [cx, cy, cz] = this._center
    const r = this._radius

    // Center model at origin, then apply auto-rotate around Y (Y-down axis = vertical spin).
    const model = mat4.create()
    mat4.rotateY(model, model, this._yaw)
    mat4.translate(model, model, [-cx, -cy, -cz])

    // Camera: slightly above (negative Y = up in Y-down) and in front of model.
    const dist = r * 2.5
    const view = mat4.create()
    mat4.lookAt(view, [0, -r * 0.5, -dist], [0, 0, 0], [0, -1, 0])

    const proj = mat4.create()
    mat4.perspective(proj, 40 * Math.PI / 180,
      this._canvas.width / this._canvas.height, 0.1, dist * 10)

    gl.uniformMatrix4fv(uniforms.model,      false, model)
    gl.uniformMatrix4fv(uniforms.view,       false, view)
    gl.uniformMatrix4fv(uniforms.projection, false, proj)
  }
}
