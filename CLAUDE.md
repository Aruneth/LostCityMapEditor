# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
./gradlew run           # Run the application
./gradlew build         # Compile and build
./gradlew test          # Run all tests
./gradlew test --tests <ClassName>  # Run a single test class
./gradlew jlinkZip      # Build distribution ZIP
```

On Windows use `gradlew.bat` instead of `./gradlew`.

## Architecture

This is a JavaFX + OpenGL 3D map editor for the Lost City game server (RuneScape-like). The editor loads server data packs from a user-selected directory and renders JM2 map files in 3D.

### Data flow

1. **Startup**: `LostCityMapEditor.main()` → `OpenGLRenderer.startRender()`
2. **Asset loading**: User picks a server directory; `FileLoader` parses all packs (FLO/LOC/NPC/OBJ/OPT/OB2) into typed maps
3. **Map parsing**: `MapDataTransformer.parseJM2File()` produces a `MapData` — a 4-level, 64×64 `TileData[4][64][64]` grid plus `LocData`, `NpcData`, and `ObjData` lists
4. **Rendering**: `MapData` is handed to `World`/`World3D` (legacy engine code), which emit `newTriangle` objects; `VertexDataHandler` uploads these to GPU VAO/VBOs, grouped by texture for batched draws
5. **Edit → re-render**: Tile or entity edits modify `MapData` in-place (after pushing to `historyStack` for undo), then call `drawNewMap()` to rebuild the triangle mesh

### Package responsibilities

| Package | Role |
|---|---|
| `Renderer` | GLFW window, OpenGL render loop, JavaFX UI panels, mouse picking, undo/redo, model preview |
| `DataObjects` | Plain data containers: `MapData`, `TileData`, `LocData`, `NpcData`, `ObjData`, overlay/underlay definitions |
| `Loaders` | Coordinates loading of all asset packs; lists and exports JM2 files |
| `Transformers` | Format-specific parsers/writers (one class per file format) |
| `OriginalCode` | Ported legacy engine code — handles 3D tile/entity placement (`World`), rasterization (`Pix3D`), and type definitions (`LocType`, `TileOverlay`, etc.) |
| `Util` | Color conversion (RGB ↔ HSL), data parsing helpers, model viewer UI helper |

### Cross-cutting concerns

- **GL thread safety**: All OpenGL calls must run on the GLFW thread. Use `glQueue` (a `BlockingQueue`) to post tasks from JavaFX UI handlers; the main loop drains this queue each frame.
- **Undo system**: `saveStateBeforeChange()` deep-copies `MapData` onto `historyStack` (max 30 entries) before any edit. Ctrl+Z pops the stack and calls `drawNewMap()`.
- **`OriginalCode` is not idiomatic Java** — it is decompiled/ported game engine code. Avoid refactoring it unless strictly necessary; prefer wrapping it.

### Key controls (editor UX)

- **W/A/S/D** — move camera; **Q/E** — zoom; **Right-click drag** — rotate
- **Left-click** — inspect tile; **Ctrl+click** — edit tile; **L/N/O + click** — place Loc/NPC/Object
- **Ctrl+C / Ctrl+V** — copy/paste tile; **Ctrl+Z** — undo

### Tech stack

- Java 21, JavaFX 21 (UI panels embedded in a Swing `JFrame`)
- LWJGL 3.3.6 (OpenGL via GLFW)
- JOML 1.10.5 (3D math)
- JUnit 5 (test framework configured; no tests exist yet)
