export class UnderlayData {
  constructor(id) {
    this.id = id
  }

  clone() {
    return new UnderlayData(this.id)
  }
}
