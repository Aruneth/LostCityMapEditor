export class NpcData {
  constructor(level, x, z, id) {
    this.level = level
    this.x     = x
    this.z     = z
    this.id    = id
  }

  clone() {
    return new NpcData(this.level, this.x, this.z, this.id)
  }
}
