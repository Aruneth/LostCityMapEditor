// Runtime NPC container holding a rendered model, height, and collision size.
// Used by WorldBuilder (T09) when placing NPCs in the world.
export class Npc {
  constructor(height, model, size) {
    this.height = height
    this.model  = model   // Ob2Model
    this.size   = size
  }
}
