export class ObjData {
  constructor(level, x, z, id, count) {
    this.level = level
    this.x     = x
    this.z     = z
    this.id    = id
    this.count = count
  }

  clone() {
    return new ObjData(this.level, this.x, this.z, this.id, this.count)
  }

  toString() {
    return `ObjData{id=${this.id}, count=${this.count}}`
  }
}
