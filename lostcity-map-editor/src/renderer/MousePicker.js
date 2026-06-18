import { mat4, vec4 } from 'gl-matrix'

// Parallel to a triangle — too small to be a valid intersection.
const EPSILON = 1e-6

export class MousePicker {
  // Called every frame by Renderer._loop().
  // Returns { x, z } of the closest hit tile, or null when no triangle is hit.
  update(mouseX, mouseY, camera, canvas, triangles) {
    if (triangles.length === 0) return null

    const aspect = canvas.width / canvas.height
    const view   = camera.getViewMatrix()
    const proj   = camera.getProjectionMatrix(aspect)
    const ray    = _getRay(mouseX, mouseY, view, proj, canvas)

    return _intersectTriangles(ray, triangles)
  }
}

// Unprojects a screen pixel into a world-space ray via the inverse VP matrix.
function _getRay(mouseX, mouseY, viewMatrix, projMatrix, canvas) {
  const ndcX =  (mouseX / canvas.width)  * 2 - 1
  const ndcY = -(mouseY / canvas.height) * 2 + 1

  const vp    = mat4.multiply(mat4.create(), projMatrix, viewMatrix)
  const invVP = mat4.invert(mat4.create(), vp)

  const near4 = vec4.fromValues(ndcX, ndcY, -1, 1)
  const far4  = vec4.fromValues(ndcX, ndcY,  1, 1)
  vec4.transformMat4(near4, near4, invVP)
  vec4.transformMat4(far4,  far4,  invVP)

  const wN = near4[3], wF = far4[3]
  const ox = near4[0] / wN, oy = near4[1] / wN, oz = near4[2] / wN
  const fx = far4[0]  / wF, fy = far4[1]  / wF, fz = far4[2]  / wF

  let dx = fx - ox, dy = fy - oy, dz = fz - oz
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz)
  dx /= len; dy /= len; dz /= len

  return { ox, oy, oz, dx, dy, dz }
}

// Möller–Trumbore intersection over all visible triangles.
// Returns { x, z } of the closest hit, or null.
function _intersectTriangles(ray, triangles) {
  const { ox, oy, oz, dx, dy, dz } = ray

  let minT = Infinity
  let hitX = null, hitZ = null, hitLevel = 0

  for (const tri of triangles) {
    if (!tri.isVisible()) continue

    const verts = tri.vertices
    const ax = verts[0], ay = verts[1], az = verts[2]
    const bx = verts[3], by = verts[4], bz = verts[5]
    const cx = verts[6], cy = verts[7], cz = verts[8]

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az

    // h = direction × e2
    const hx = dy * e2z - dz * e2y
    const hy = dz * e2x - dx * e2z
    const hz = dx * e2y - dy * e2x

    const det = e1x * hx + e1y * hy + e1z * hz
    if (Math.abs(det) < EPSILON) continue

    const invDet = 1 / det

    // u barycentric coordinate
    const sx = ox - ax, sy = oy - ay, sz = oz - az
    const u = (sx * hx + sy * hy + sz * hz) * invDet
    if (u < 0 || u > 1) continue

    // q = s × e1, v barycentric coordinate
    const qx = sy * e1z - sz * e1y
    const qy = sz * e1x - sx * e1z
    const qz = sx * e1y - sy * e1x
    const v  = (dx * qx + dy * qy + dz * qz) * invDet
    if (v < 0 || u + v > 1) continue

    const t = (e2x * qx + e2y * qy + e2z * qz) * invDet
    if (t > EPSILON && t < minT) {
      minT = t
      hitX = tri.tileX
      hitZ = tri.tileZ
      hitLevel = tri.level
    }
  }

  return hitX !== null ? { x: hitX, z: hitZ, level: hitLevel } : null
}
