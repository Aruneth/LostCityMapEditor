# Lost City Map Editor

A 3D map editor for the [Lost City](https://github.com/2004scape/Server) RuneScape emulation server. Loads server data packs directly from a local server directory and lets you view and edit `.jm2` map files in real time.

Built with Electron + Vite + WebGL2.

---

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer

---

## Getting started

```bash
cd lostcity-map-editor
npm install
npm run dev
```

To build a distributable:

```bash
npm run dist
```

---

## Usage

1. Click **Open Server Directory** and point it at the root of your Lost City server (the folder that contains `pack/`, `data/src/`, etc.).
2. Select a map from the dropdown and click **Load Map**.
3. Edit tiles and entities, then click **Save Map** to write changes back to the server directory.

---

## Controls

| Input | Action |
|---|---|
| W / A / S / D | Move camera |
| Q / E | Zoom in / out |
| Right-click drag | Rotate camera |
| Left-click | Inspect tile / select entity |
| Ctrl + Left-click | Edit tile |
| L + Left-click | Place LOC at cursor |
| N + Left-click | Place NPC at cursor |
| O + Left-click | Place object at cursor |
| Ctrl + C | Copy hovered tile |
| Ctrl + V | Paste tile at cursor |
| Ctrl + Z | Undo |
| F2 | Open world map |
| Escape | Cancel add / move mode |

---

## Features

- **Multi-region loading** — loads a configurable grid (1×1 up to 9×9) of adjacent map regions simultaneously, with seamless height stitching at borders.
- **Tile editor** — edit height, underlay/overlay floor type, shape, rotation, and flags.
- **LOC editor** — add, move, delete, and edit shape/rotation of location objects. Supports recol/retex substitutions for correct per-loc textures.
- **NPC & item editor** — add, move, and delete NPCs and ground items.
- **Entity selection priority** — clicking a tile with a door and a doormat selects the door.
- **Model preview** — right sidebar shows a 3D preview of the selected entity's model.
- **Minimap** — live overhead minimap with region borders; click to teleport the camera.
- **Undo** — up to 30 steps for tile and entity edits.
- **Save / Export** — save all loaded regions back to the server directory, or export a single region via *Export As…*

---

## Settings

The **Settings** menu (in the menu bar) lets you change the load radius (how many adjacent regions to load alongside the primary map).
