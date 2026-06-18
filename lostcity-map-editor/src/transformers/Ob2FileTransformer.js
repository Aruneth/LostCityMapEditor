import { Model } from '../data/Model.js'

// Helper that wraps an ArrayBuffer with positional read methods,
// equivalent to the inner OB2Packet class in Java.
class OB2Packet {
  constructor(buffer) {
    // Accept ArrayBuffer, Uint8Array, or plain number[]
    if (buffer instanceof ArrayBuffer) {
      this._data = new Uint8Array(buffer)
    } else if (buffer instanceof Uint8Array) {
      this._data = buffer
    } else {
      this._data = new Uint8Array(buffer)
    }
    this.pos = 0
  }

  get length() { return this._data.length }

  setPosition(p) { this.pos = p }

  getUnsignedByte() { return this._data[this.pos++] & 0xFF }

  getUnsignedShort() {
    return ((this._data[this.pos++] & 0xFF) << 8) | (this._data[this.pos++] & 0xFF)
  }

  // "smart" variable-length int: if first byte < 128, read 1 byte and subtract 64;
  // otherwise read 2 bytes (big-endian unsigned short) and subtract 49152.
  gSmart() {
    if ((this._data[this.pos] & 0xFF) < 128) {
      return this.getUnsignedByte() - 64
    }
    return this.getUnsignedShort() - 49152
  }
}

// Parse a single OB2 binary file (ArrayBuffer) into a Model.
export function parseOb2(buffer) {
  const model = new Model()
  const full  = new OB2Packet(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer)

  // Footer is 18 bytes from the end — mirrors Java's setPosition(data.length - 18)
  full.setPosition(full.length - 18)
  const vertexCount        = full.getUnsignedShort()
  const faceCount          = full.getUnsignedShort()
  const texturedFaceCount  = full.getUnsignedByte()
  const hasInfo            = full.getUnsignedByte() === 1
  const hasPriorities      = full.getUnsignedByte()
  const hasAlpha           = full.getUnsignedByte() === 1
  const hasFaceLabels      = full.getUnsignedByte() === 1
  const hasVertexLabels    = full.getUnsignedByte() === 1
  const vertexXLength      = full.getUnsignedShort()
  const vertexYLength      = full.getUnsignedShort()
  const vertexZLength      = full.getUnsignedShort()
  const faceVertexLength   = full.getUnsignedShort()

  model.faceCount    = faceCount
  model.faceIndicesA = new Int32Array(faceCount)
  model.faceIndicesB = new Int32Array(faceCount)
  model.faceIndicesC = new Int32Array(faceCount)
  model.faceColors   = new Int32Array(faceCount)
  model.vertexCount  = vertexCount
  model.verticesX    = new Int32Array(vertexCount)
  model.verticesY    = new Int32Array(vertexCount)
  model.verticesZ    = new Int32Array(vertexCount)

  model.texturedFaceCount = texturedFaceCount
  if (texturedFaceCount > 0) {
    model.textureMCoordinate = new Int32Array(texturedFaceCount)
    model.texturePCoordinate = new Int32Array(texturedFaceCount)
    model.textureNCoordinate = new Int32Array(texturedFaceCount)
  }

  // Read sequential sections starting at byte 0
  full.setPosition(0)

  const vertexFlags = readBytes(full, vertexCount)
  const faceIndices = readBytes(full, faceCount)

  let priorities = null
  if (hasPriorities === 255) {
    priorities = readBytes(full, faceCount)
    model.facePriorities = new Int32Array(priorities)
  }

  if (hasFaceLabels) {
    model.faceLabels = new Int32Array(readBytes(full, faceCount))
  }

  let faceInfo = null
  if (hasInfo) {
    faceInfo = readBytes(full, faceCount)
    // textureCoords can be decoded now; faceTextures must wait until processColors()
    // has populated model.faceColors (those slots hold the texture pack ID for textured faces).
    const textureCoords = new Int32Array(faceCount)
    for (let i = 0; i < faceCount; i++) {
      textureCoords[i] = (faceInfo[i] & 0x2) === 2 ? (faceInfo[i] >> 2) : -1
    }
    model.faceInfos     = new Int32Array(faceInfo)
    model.textureCoords = textureCoords
    // model.faceTextures filled below, after processColors()
  }

  if (hasVertexLabels) {
    model.vertexLabels = new Int32Array(readBytes(full, vertexCount))
  }

  if (hasAlpha) {
    model.faceAlphas = new Int32Array(readBytes(full, faceCount))
  }

  const faceVertexData   = readBytes(full, faceVertexLength)
  const faceTypeData     = readBytes(full, faceCount * 2)
  const texturedFaceData = readBytes(full, texturedFaceCount * 6)
  const vertexXData      = readBytes(full, vertexXLength)
  const vertexYData      = readBytes(full, vertexYLength)
  const vertexZData      = readBytes(full, vertexZLength)

  processVertices(model, vertexXData, vertexYData, vertexZData, vertexFlags)
  processFaces(model, faceVertexData, faceIndices)
  processColors(model, faceTypeData)

  // Now that faceColors is populated, extract texture pack IDs for textured faces.
  // For textured faces (faceInfo & 0x2 == 2), the faceColors slot holds the texture pack ID.
  if (faceInfo) {
    const faceTextures = new Int32Array(model.faceCount).fill(-1)
    for (let i = 0; i < model.faceCount; i++) {
      if ((faceInfo[i] & 0x2) === 2) faceTextures[i] = model.faceColors[i]
    }
    model.faceTextures = faceTextures
  }

  processTextures(model, texturedFaceData)

  return model
}

function readBytes(packet, count) {
  const arr = new Uint8Array(count)
  for (let i = 0; i < count; i++) arr[i] = packet.getUnsignedByte()
  return arr
}

function processVertices(model, xData, yData, zData, vertexFlags) {
  const px = new OB2Packet(xData)
  const py = new OB2Packet(yData)
  const pz = new OB2Packet(zData)
  let dx = 0, dy = 0, dz = 0
  for (let v = 0; v < model.vertexCount; v++) {
    const flags = vertexFlags[v]
    const a = (flags & 1) ? px.gSmart() : 0
    const b = (flags & 2) ? py.gSmart() : 0
    const c = (flags & 4) ? pz.gSmart() : 0
    dx += a; dy += b; dz += c
    model.verticesX[v] = dx
    model.verticesY[v] = dy
    model.verticesZ[v] = dz
  }
}

function processFaces(model, faceVertexData, faceIndices) {
  const vertData   = new OB2Packet(faceVertexData)
  const orientData = new OB2Packet(faceIndices)
  let a = 0, b = 0, c = 0, last = 0
  for (let f = 0; f < model.faceCount; f++) {
    const orientation = orientData.getUnsignedByte()
    if (orientation === 1) {
      a = vertData.gSmart() + last; last = a
      b = vertData.gSmart() + last; last = b
      c = vertData.gSmart() + last; last = c
    } else if (orientation === 2) {
      b = c
      c = vertData.gSmart() + last; last = c
    } else if (orientation === 3) {
      a = c
      c = vertData.gSmart() + last; last = c
    } else if (orientation === 4) {
      const tmp = a; a = b; b = tmp
      c = vertData.gSmart() + last; last = c
    }
    model.faceIndicesA[f] = a
    model.faceIndicesB[f] = b
    model.faceIndicesC[f] = c
  }
}

function processColors(model, faceTypeData) {
  const p = new OB2Packet(faceTypeData)
  for (let f = 0; f < model.faceCount; f++) {
    model.faceColors[f] = p.getUnsignedShort()
  }
}

function processTextures(model, texturedFaceData) {
  const p = new OB2Packet(texturedFaceData)
  for (let i = 0; i < model.texturedFaceCount; i++) {
    model.texturePCoordinate[i] = p.getUnsignedShort()
    model.textureMCoordinate[i] = p.getUnsignedShort()
    model.textureNCoordinate[i] = p.getUnsignedShort()
  }
}
