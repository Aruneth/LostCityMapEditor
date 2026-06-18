export class UndoStack {
  constructor(maxSize = 30) {
    this._stack   = []
    this._maxSize = maxSize
  }

  // Deep-clone mapData and push onto the stack before making a change.
  save(mapData) {
    this._stack.push(mapData.clone())
    if (this._stack.length > this._maxSize) this._stack.shift()
  }

  // Pop and return the most recent saved state, or null if the stack is empty.
  undo() {
    return this._stack.pop() ?? null
  }

  canUndo() {
    return this._stack.length > 0
  }
}
