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
- **Prefab system** — capture, save, load, and stamp rectangular areas of the map including tiles and objects. See [Prefab system](#prefab-system) below.

---

## Prefab system

The prefab system lets you capture a rectangular area of the map, save it to a JSON file, and stamp it back anywhere on the primary region — with optional rotation.

Open it via **Build → Prefab** in the menu bar.

### Workflow

1. **Select** — click *Start selection*, then click and drag on the map to define a rectangle. Release the mouse to confirm. The status bar shows the selection dimensions while you drag.
2. **Save / Load** — optionally save the captured area to a `.json` file or load a previously saved prefab. Old version 1 files (tiles only) load without error.
3. **Rotate** — choose 0°, 90°, 180°, or 270°. A blue overlay follows the cursor to preview the placement footprint.
4. **Place** — click *Place prefab* to enter placement mode, then click a tile on the map. The prefab is stamped with its top-left corner at that tile. Existing tiles, LOCs, and ground items inside the footprint are cleared before stamping.

### What is captured

| Data | Captured | Notes |
|---|---|---|
| Tiles (all 4 levels) | Yes | height, underlay, overlay, shape, rotation, flags |
| LOCs | Yes | rotated by the same angle as the prefab |
| Ground items (OBJs) | Yes | |
| NPCs | No | NPC spawns are not part of a prefab |

### Rotation behaviour

Position offsets are rotated around the prefab origin. LOC facing directions are also adjusted: `new_rotation = (original_rotation + prefab_rotation) % 4`.

### File format

Prefabs are stored as JSON (version 2):

```json
{
  "version": 2,
  "width": 5,
  "depth": 3,
  "tiles": { "0": { "0,0": { "height": 0, "underlayId": 1, "overlayId": -1, "shape": 0, "rotation": 0, "flag": 0 } } },
  "locs": [ { "rx": 1, "rz": 0, "level": 0, "id": 42, "shape": 10, "rotation": 0 } ],
  "objs": [ { "rx": 2, "rz": 1, "level": 0, "id": 7, "count": 1 } ]
}
```

Version 1 files (tiles only, no `locs`/`objs` keys) are still accepted.

---

## Settings

The **Settings** menu (in the menu bar) lets you change the load radius (how many adjacent regions to load alongside the primary map).
