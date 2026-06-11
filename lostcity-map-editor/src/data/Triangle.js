// Single rendered triangle, equivalent to newTriangle.java.
// The static singleton list is removed — WorldBuilder (T09) owns the triangle array.
// Color 12345678 is the sentinel value used by the original engine to skip a triangle.
const SKIP_COLOR = 12345678

export class Triangle {
  constructor({
    isModel = false,
    tileX, tileZ, level, shape, rotation,
    vertices,           // Float32Array or [x1,y1,z1, x2,y2,z2, x3,y3,z3]
    colors,             // [r1, r2, r3] — packed RGB integers
    textureId = -1,
    textureCoordinates = null,  // Float32Array or [u1,v1, u2,v2, u3,v3] | null
  }) {
    this.isModel            = isModel
    this.tileX              = tileX
    this.tileZ              = tileZ
    this.level              = level
    this.shape              = shape
    this.rotation           = rotation
    this.vertices           = vertices
    this.colors             = colors
    this.textureId          = textureId
    this.textureCoordinates = textureCoordinates
  }

  // Returns false for triangles the engine marks as invisible.
  isVisible() {
    return this.colors[0] !== SKIP_COLOR
  }
}

export { SKIP_COLOR }
