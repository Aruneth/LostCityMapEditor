import { SceneState } from './SceneState.js'

// Core WebGL renderer — equivalent to the relevant parts of OpenGLRenderer.java.
// Owns the WebGL2 context, the render loop, the glQueue, and raw input state.
// Higher-level systems (Camera T08, MousePicker T12, ShaderManager T06) are
// injected after construction via attach().
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas

    const gl = canvas.getContext('webgl2')
    if (!gl) throw new Error('WebGL2 is not supported in this environment.')
    this.gl = gl

    // Callbacks queued from UI handlers and executed on the next render frame.
    // Equivalent to Java's BlockingQueue<Runnable> glQueue.
    this.glQueue = []

    // Timing — mirrors Java's deltaTime / lastFrame pattern.
    this.deltaTime = 0
    this._lastTimestamp = 0

    // Raw input state — read by Camera (T08) and editor actions (T13/T14/T15/T16).
    this.mouseX = 0
    this.mouseY = 0
    this.keysHeld = new Set()         // lowercase key names, e.g. 'w', 'l', 'control'
    this.rightMouseHeld = false
    this.leftMouseJustClicked  = false // consumed once per click in the loop
    this.rightMouseJustClicked = false // true only when right-click released with < 5px drag
    this._rightDragDist        = 0     // accumulated drag distance for current right-press

    // Accumulated mouse movement since the last frame — consumed by Camera.update().
    this.mouseMoveDX = 0
    this.mouseMoveDY = 0

    // Injected systems — set via attach() once each subsystem is implemented.
    this.camera       = null  // T08
    this.mousePicker  = null  // T12
    this.shaderProgram = null // T06
    this.vertexData   = null  // T06

    this.scene = new SceneState()

    this._initGL()
    this._initResizeObserver()
    this._initInputHandlers()
  }

  // --- Initialisation ---

  _initGL() {
    const { gl } = this
    gl.clearColor(0.18, 0.18, 0.18, 1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    // Start with the canvas at its CSS-rendered size.
    this._resizeViewport()
  }

  _initResizeObserver() {
    // ResizeObserver fires whenever the canvas element itself changes size
    // (e.g. window resize, sidebar toggle). More precise than window 'resize'.
    const observer = new ResizeObserver(() => this._resizeViewport())
    observer.observe(this.canvas)
  }

  _resizeViewport() {
    const { canvas, gl } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w
      canvas.height = h
    }
    gl.viewport(0, 0, w, h)
  }

  _initInputHandlers() {
    const { canvas } = this

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect()
      this.mouseX = e.clientX - rect.left
      this.mouseY = e.clientY - rect.top
      if (this.rightMouseHeld) {
        this.mouseMoveDX += e.movementX
        this.mouseMoveDY += e.movementY
        this._rightDragDist += Math.abs(e.movementX) + Math.abs(e.movementY)
      }
    })

    canvas.addEventListener('wheel', e => {
      if (this.camera) this.camera.processMouseScroll(-Math.sign(e.deltaY))
    }, { passive: true })

    canvas.addEventListener('mousedown', e => {
      if (e.button === 2) { this.rightMouseHeld = true; this._rightDragDist = 0 }
      if (e.button === 0) this.leftMouseJustClicked = true
    })

    canvas.addEventListener('mouseup', e => {
      if (e.button === 2) {
        this.rightMouseHeld = false
        if (this._rightDragDist < 5) this.rightMouseJustClicked = true
      }
    })

    // Prevent browser context menu on right-click inside canvas.
    canvas.addEventListener('contextmenu', e => e.preventDefault())

    // Track all held keys. Storing lowercase normalises e.g. 'Control' → 'control'.
    // Skip when a form field is focused to avoid camera movement while typing.
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      this.keysHeld.add(e.key.toLowerCase())
    })
    window.addEventListener('keyup', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      this.keysHeld.delete(e.key.toLowerCase())
    })
  }

  // --- Public API ---

  // Inject a subsystem after construction. Called once per system as tickets complete.
  attach(name, system) {
    this[name] = system
  }

  // Push a callback onto the GL queue. Runs on the next frame, on the render thread.
  // Use this from UI event handlers to trigger map loads or scene rebuilds.
  enqueue(task) {
    this.glQueue.push(task)
  }

  start() {
    requestAnimationFrame(ts => this._loop(ts))
  }

  // --- Render loop ---

  _loop(timestamp) {
    this.deltaTime = (timestamp - this._lastTimestamp) / 1000
    this._lastTimestamp = timestamp

    // 1. Update camera movement from held keys + mouse drag (T08).
    if (this.camera) {
      this.camera.update(this.deltaTime, this.keysHeld, this.mouseMoveDX, this.mouseMoveDY)
    }
    this.mouseMoveDX = 0
    this.mouseMoveDY = 0

    // 2. Update hovered tile via ray casting (T12).
    //    Skip while right-click rotating — matches Java behaviour.
    if (this.mousePicker && this.camera && !this.rightMouseHeld) {
      this.scene.hoveredTile = this.mousePicker.update(
        this.mouseX,
        this.mouseY,
        this.camera,
        this.canvas,
        this.scene.triangles,
      )
    }

    // 3. Handle click editor actions.
    if (this.leftMouseJustClicked) {
      this.leftMouseJustClicked = false
      if (this.onLeftClick) this.onLeftClick(this.keysHeld, this.scene.hoveredTile)
    }
    if (this.rightMouseJustClicked) {
      this.rightMouseJustClicked = false
      if (this.onRightClick) this.onRightClick(this.keysHeld, this.scene.hoveredTile)
    }

    // 4. Drain queued GL tasks (map loads, scene rebuilds, etc.).
    while (this.glQueue.length > 0) {
      this.glQueue.shift()()
    }

    // 5. Clear and draw.
    const { gl } = this
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    if (this.shaderManager && this.camera && this.scene.vaoGroups.size > 0) {
      this._drawScene()
    }

    requestAnimationFrame(ts => this._loop(ts))
  }

  // Called when ShaderManager (T06) and Camera (T08) are attached.
  _drawScene() {
    const { gl, shaderManager, camera, scene, canvas } = this

    gl.useProgram(shaderManager.program)

    // Camera uploads model/view/projection uniforms using cached locations.
    // Signature: camera.uploadUniforms(gl, uniformLocations, aspect) — implemented in T08.
    const aspect = canvas.width / canvas.height
    camera.uploadUniforms(gl, shaderManager.uniforms, aspect)

    // Upload hover uniform — -1.0 means nothing hovered.
    const h = this.scene.hoveredTile
    gl.uniform1f(shaderManager.uniforms.uHoveredTileXZ, h ? h.x * 1024 + h.z : -1.0)

    // Draw each texture group (one VAO per texture — see VertexDataHandler).
    for (const [_texId, { vao, count, glTexture }] of scene.vaoGroups) {
      if (glTexture) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, glTexture)
        gl.uniform1i(shaderManager.uniforms.uTexture, 0)
      }
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLES, 0, count)
    }

    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }
}
