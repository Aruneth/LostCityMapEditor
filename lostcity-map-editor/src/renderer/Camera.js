import { mat4, vec3 } from 'gl-matrix'

const DEG = Math.PI / 180

// Port of Camera.java (JOML/GLFW → gl-matrix/DOM).
// worldUp is (0, -1, 0) — preserved from Java to match the game's Y-down convention.
// Initial position matches OpenGLRenderer: (4400, -7000, 4000).
export class Camera {
  constructor(position = [4400, -7000, 4000]) {
    this.position = [...position]
    this.worldUp  = [0, -1, 0]

    this.yaw   = 90   // degrees
    this.pitch = 90

    this.movementSpeed    = 3000
    this.mouseSensitivity = 0.1
    this.zoom             = 40    // FOV in degrees
    this.scrollZoomStep   = 250

    this.front = [0, 0, -1]
    this.up    = [0, 0,  0]
    this.right = [0, 0,  0]

    this._updateVectors()
  }

  // Called every frame from Renderer._loop().
  // mouseDX/mouseDY are pixel deltas accumulated since the previous frame (right-drag only).
  update(deltaTime, keysHeld, mouseDX = 0, mouseDY = 0) {
    const vel         = this.movementSpeed * deltaTime
    const forwardFlat = this._flatProject(this.front)
    const rightFlat   = this._flatProject(this.right)

    if (keysHeld.has('w')) this._move(forwardFlat,  vel)
    if (keysHeld.has('s')) this._move(forwardFlat, -vel)
    if (keysHeld.has('a')) this._move(rightFlat,   -vel)
    if (keysHeld.has('d')) this._move(rightFlat,    vel)
    // Q/E zoom moves along world Y — matches Java's ZOOM_IN/ZOOM_OUT logic.
    if (keysHeld.has('q')) this.position[1] -= vel
    if (keysHeld.has('e')) this.position[1] += vel

    if (mouseDX !== 0 || mouseDY !== 0) {
      this.processMouseMovement(mouseDX, mouseDY, true)
    }
  }

  // Right-drag rotation. xOffset/yOffset are raw pixel deltas.
  processMouseMovement(xOffset, yOffset, constrainPitch = true) {
    this.yaw   -= xOffset * this.mouseSensitivity
    this.pitch -= yOffset * this.mouseSensitivity
    if (constrainPitch) {
      this.pitch = Math.max(-89, Math.min(89, this.pitch))
    }
    this._updateVectors()
  }

  // Mouse wheel zoom — yOffset > 0 = zoom in (same sign as GLFW callback).
  processMouseScroll(yOffset) {
    if (yOffset > 0) {
      this.position[1] -= this.scrollZoomStep
    } else if (yOffset < 0) {
      this.position[1] += this.scrollZoomStep
    }
  }

  getViewMatrix() {
    const eye    = this.position
    const center = vec3.add(vec3.create(), eye, this.front)
    const out    = mat4.create()
    mat4.lookAt(out, eye, center, this.up)
    return out
  }

  getProjectionMatrix(aspect) {
    const proj = mat4.create()
    mat4.perspective(proj, this.zoom * DEG, aspect, 10, 15000)
    return proj
  }

  // Uploads model/view/projection uniforms. Called by Renderer._drawScene().
  uploadUniforms(gl, uniforms, aspect) {
    const model = mat4.create()   // identity
    const view  = this.getViewMatrix()
    const proj  = mat4.create()
    mat4.perspective(proj, this.zoom * DEG, aspect, 10, 15000)

    gl.uniformMatrix4fv(uniforms.model,      false, model)
    gl.uniformMatrix4fv(uniforms.view,       false, view)
    gl.uniformMatrix4fv(uniforms.projection, false, proj)
  }

  // --- Private ---

  // Projects vector v onto the plane perpendicular to worldUp, then normalises.
  _flatProject(v) {
    const wu  = this.worldUp
    const dot = v[0]*wu[0] + v[1]*wu[1] + v[2]*wu[2]
    const fx  = v[0] - dot*wu[0]
    const fy  = v[1] - dot*wu[1]
    const fz  = v[2] - dot*wu[2]
    const len2 = fx*fx + fy*fy + fz*fz
    if (len2 > 1e-8) {
      const inv = 1 / Math.sqrt(len2)
      return [fx*inv, fy*inv, fz*inv]
    }
    return [0, 0, 0]
  }

  _move(dir, amount) {
    this.position[0] += dir[0] * amount
    this.position[1] += dir[1] * amount
    this.position[2] += dir[2] * amount
  }

  _updateVectors() {
    const y = this.yaw   * DEG
    const p = this.pitch * DEG
    const cosP = Math.cos(p)
    const fx = Math.cos(y) * cosP
    const fy = Math.sin(p)
    const fz = Math.sin(y) * cosP
    const fLen = Math.sqrt(fx*fx + fy*fy + fz*fz)
    this.front = [fx/fLen, fy/fLen, fz/fLen]

    // right = normalize(front × worldUp)
    const r = vec3.cross(vec3.create(), this.front, this.worldUp)
    vec3.normalize(r, r)
    this.right = [...r]

    // up = normalize(right × front)
    const u = vec3.cross(vec3.create(), r, this.front)
    vec3.normalize(u, u)
    this.up = [...u]
  }
}
