// 3D model data container — mirrors Model.java fields used by Ob2FileTransformer and WorldBuilder.
export class Model {
  constructor() {
    this.vertexCount   = 0
    this.verticesX     = null   // Int32Array
    this.verticesY     = null
    this.verticesZ     = null

    this.faceCount     = 0
    this.faceIndicesA  = null   // Int32Array
    this.faceIndicesB  = null
    this.faceIndicesC  = null
    this.faceColors    = null   // Int32Array — packed HSL

    this.texturedFaceCount   = 0
    this.texturePCoordinate  = null
    this.textureMCoordinate  = null
    this.textureNCoordinate  = null

    this.facePriorities = null
    this.faceLabels     = null
    this.faceInfos      = null
    this.faceTextures   = null
    this.textureCoords  = null
    this.faceAlphas     = null
    this.vertexLabels   = null
  }
}
