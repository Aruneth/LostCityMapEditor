// WebGL2 equivalent of ShaderManager.java.
// Shaders ported from GLSL 3.30 core → GLSL ES 3.00 (WebGL2).
//
// Vertex layout (10 floats/vertex, stride = 40 bytes):
//   location 0 — aPos       vec3  offset  0
//   location 1 — aColor     vec3  offset 12
//   location 2 — aTexCoord  vec2  offset 24
//   location 3 — aUseTexture float offset 32
//   location 4 — aIsHovered float offset 36
//
// aTextureID from Java is removed — one VAO per texture group makes it unnecessary.

const VERT_SRC = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aColor;
layout(location = 2) in vec2 aTexCoord;
layout(location = 3) in float aUseTexture;
layout(location = 4) in float aIsHovered;

out vec3  vertexColor;
out vec2  TexCoord;
out float useTexture;
out float isHovered;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main() {
  gl_Position = projection * view * model * vec4(aPos, 1.0);
  vertexColor = aColor;
  TexCoord    = aTexCoord;
  useTexture  = aUseTexture;
  isHovered   = aIsHovered;
}`

const FRAG_SRC = `#version 300 es
precision mediump float;

in vec3  vertexColor;
in vec2  TexCoord;
in float useTexture;
in float isHovered;

out vec4 FragColor;
uniform sampler2D uTexture;

void main() {
  vec3 base = vertexColor;

  if (isHovered > 0.5) {
    base = min(base + vec3(0.2), vec3(1.0));
  }

  if (useTexture > 0.5) {
    vec4 texColor = texture(uTexture, TexCoord);
    if (texColor.a < 0.1) discard;
    FragColor = isHovered > 0.5
      ? texColor * vec4(base, 1.0)
      : texColor;
  } else {
    FragColor = vec4(base, 1.0);
  }
}`

export class ShaderManager {
  constructor() {
    this.program  = null
    // Cached uniform locations — set in createProgram().
    this.uniforms = {
      model:      null,
      view:       null,
      projection: null,
      uTexture:   null,
    }
  }

  createProgram(gl) {
    const vert = compileShader(gl, VERT_SRC, gl.VERTEX_SHADER)
    const frag = compileShader(gl, FRAG_SRC, gl.FRAGMENT_SHADER)

    const prog = gl.createProgram()
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Shader link error: ' + gl.getProgramInfoLog(prog))
    }

    gl.deleteShader(vert)
    gl.deleteShader(frag)

    this.program = prog

    // Cache uniform locations once — avoids repeated lookups per frame.
    gl.useProgram(prog)
    this.uniforms.model      = gl.getUniformLocation(prog, 'model')
    this.uniforms.view       = gl.getUniformLocation(prog, 'view')
    this.uniforms.projection = gl.getUniformLocation(prog, 'projection')
    this.uniforms.uTexture   = gl.getUniformLocation(prog, 'uTexture')
    gl.uniform1i(this.uniforms.uTexture, 0)   // texture unit 0
    gl.useProgram(null)

    return prog
  }
}

function compileShader(gl, source, type) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const label = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'
    throw new Error(`${label} shader compile error:\n${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}
