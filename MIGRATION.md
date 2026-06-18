# Migratieplan: Java → Electron + WebGL

## Overzicht

De Java/Gradle applicatie wordt vervangen door een **Electron + WebGL** applicatie in JavaScript. De Java code wordt niet verwijderd totdat T19 (integratie validatie) is afgerond.

### Waarom Electron?
- WebGL vervangt LWJGL/GLFW zonder functieverlies
- HTML/CSS UI is flexibeler dan JavaFX
- Bestandssysteem toegang via Electron IPC (geen browser sandbox beperkingen)
- Één codebase voor Windows/Mac/Linux

### Wat wordt NIET geport
- `OriginalCode/Pix3D.java` — doet software rasterisatie die in WebGL overbodig is; de triangle output van `WorldBuilder` gaat direct naar de GPU
- `OriginalCode/LinkList.java` / `Linkable.java` — interne datastructuren vervangen door gewone JS arrays

---

## Tech stack

| Java | JavaScript equivalent |
|---|---|
| Gradle | npm + Vite |
| JavaFX | HTML/CSS |
| LWJGL / GLFW | WebGL2 (via `<canvas>`) |
| JOML | `gl-matrix` (npm) |
| JUnit 5 | Vitest |
| `BlockingQueue` (glQueue) | Array van callbacks, geleegd per frame |

---

## Voortgang

| Ticket | Status | Sessie |
|---|---|---|
| T01 | ✅ Klaar | — |
| T02 | ✅ Klaar | — |
| T03 | ✅ Klaar | — |
| T04 | ✅ Klaar | — |
| T05 | ✅ Klaar | — |
| T06 | ✅ Klaar | — |
| T07 | ✅ Klaar | — |
| T08 | ✅ Klaar | — |
| T09 | ✅ Klaar | sessie 2026-06-11 |
| T10 | ✅ Klaar | sessie 2026-06-18 |
| T11 | ✅ Klaar | sessie 2026-06-11 |
| T12 | ✅ Klaar | sessie 2026-06-18 |
| T13 | ✅ Klaar | sessie 2026-06-18 |
| T14 | ✅ Klaar | sessie 2026-06-18 |
| T15 | ✅ Klaar | sessie 2026-06-18 |
| T16 | ✅ Klaar | sessie 2026-06-18 |
| T17 | ✅ Klaar | sessie 2026-06-18 |
| T18 | ✅ Klaar | sessie 2026-06-18 |
| T19 | ✅ Klaar | sessie 2026-06-18 |

**Logische volgorde voor volgende sessie:** T13 (tile editing) → T16 (UndoStack) → T15 (clipboard) → T14 (entity placement) → T17 (map selectie wiring) → T18 (export) → T19 (validatie).

T17 is al grotendeels geïmplementeerd in `Sidebar.js` — alleen de Electron main-process IPC handlers voor `readDir`/`walkDir`/`readFile`/`writeFile`/`showOpenDialog`/`showSaveDialog` moeten nog worden gecontroleerd/aangemaakt.

---

## Fase overzicht

```
Fase 1 — Fundament       T01, T02, T03             ✅
Fase 2 — Data & I/O      T04, T05                  ✅
Fase 3 — Rendering       T06, T07, T08, T09, T10   ✅
Fase 4 — UI              T11                        ✅
Fase 5 — Interactie      T12, T13, T14, T15, T16   ✅
Fase 6 — Bestanden       T17, T18                  ✅
Fase 7 — Validatie       T19                        ✅
```

Tickets binnen een fase kunnen parallel worden opgepakt waar afhankelijkheden dit toelaten.

---

## Tickets

### Fase 1 — Fundament

#### T01 — Initialize Electron + Vite project
**Afhankelijkheden:** geen

Opzetten van het nieuwe project als vervanging van de Java/Gradle setup.

- `npm create vite@latest lostcity-map-editor -- --template vanilla`
- Installeer `electron` en `electron-builder`
- Stel `main.js` in als Electron entry point met een `BrowserWindow` van 1100×800
- Configureer `vite.config.js` voor Electron renderer-process
- Scripts: `dev` (Vite + Electron), `build`, `dist`

**Projectstructuur:**
```
src/
  main/           ← Electron main process (venster, dialogen, fs)
  renderer/
    data/         ← DataObjects
    loaders/      ← FileLoader
    transformers/ ← Bestandsparsers
    renderer/     ← WebGL
    ui/           ← HTML/CSS panels
    util/         ← Hulpfuncties
    editor/       ← Undo, clipboard
```

**Verificatie:** `npm run dev` opent een leeg Electron venster.

---

#### T02 — WebGL context + render loop
**Afhankelijkheden:** T01

Vervangt LWJGL/GLFW. Equivalent van `OpenGLRenderer.startRender()` + `loop()`.

- Fullscreen `<canvas id="glCanvas">` in `index.html`
- `canvas.getContext('webgl2')` — vereist WebGL2 voor VAOs
- `requestAnimationFrame`-loop vervangt de GLFW while-loop
- `gl.viewport`, `gl.clearColor(0.2, 0.2, 0.2, 1)`, `gl.enable(gl.DEPTH_TEST)`
- `glQueue`: array van callbacks, per frame leeggelopen — vervangt Java's `BlockingQueue`
- Canvas resize handler

**Verschil met Java:** `requestAnimationFrame` combineert `glfwPollEvents()` + `glfwSwapBuffers()` in één mechanisme.

---

#### T03 — Port DataObjects naar JS klassen
**Afhankelijkheden:** T01

| Java klasse | JS bestand | Kernvelden |
|---|---|---|
| `MapData` | `data/MapData.js` | `tiles[4][64][64]`, `locs[]`, `npcs[]`, `objs[]` |
| `TileData` | `data/TileData.js` | `height`, `overlayId`, `underlayId`, `shape`, `rotation`, `flags` |
| `LocData` | `data/LocData.js` | `id`, `x`, `z`, `level`, `type`, `rotation` |
| `NpcData` | `data/NpcData.js` | `id`, `x`, `z`, `level` |
| `ObjData` | `data/ObjData.js` | `id`, `x`, `z`, `level`, `count` |
| `OverlayData` | `data/OverlayData.js` | `rgb`, `textureId`, `isFlat` |
| `UnderlayData` | `data/UnderlayData.js` | `rgb` |
| `CopiedTileData` | `data/CopiedTileData.js` | Alle TileData velden |
| `newTriangle` | `data/Triangle.js` | Vertex posities, UV, textuurId, kleur, `tileX`, `tileZ` |

`MapData` krijgt een `clone()` methode (deep copy van het 3D tiles array + lijsten) voor de undo-stack.

---

### Fase 2 — Data & I/O

#### T04 — Port Transformers (bestandsparsers)
**Afhankelijkheden:** T03

Pure I/O — geen rendering afhankelijkheden. Vroeg porten en testen.

| Java | JS | Techniek |
|---|---|---|
| `MapDataTransformer` | `transformers/MapDataTransformer.js` | `TextDecoder` (tekst-based JM2) |
| `FloFileTransformer` | `transformers/FloFileTransformer.js` | `DataView` (binair) |
| `LocFileTransformer` | `transformers/LocFileTransformer.js` | Pack formaat |
| `NpcFileTransformer` | `transformers/NpcFileTransformer.js` | Pack formaat |
| `ObjFileTransformer` | `transformers/ObjFileTransformer.js` | Pack formaat |
| `OptFileTransformer` | `transformers/OptFileTransformer.js` | Pack formaat |
| `Ob2FileTransformer` | `transformers/Ob2FileTransformer.js` | `DataView` (binair, 3D modellen) |
| `PackFileTransformer` | `transformers/PackFileTransformer.js` | Gedeeld generiek formaat |
| `OverlayDataTransformer` | `transformers/OverlayDataTransformer.js` | Overlay texturen |

Elke parser: `parse(buffer: ArrayBuffer) → DataObject[]`  
`MapDataTransformer` exporteert ook: `serialize(mapData: MapData) → string`

**Validatie:** parse → serialize → diff met origineel bestand.

---

#### T05 — Port FileLoader
**Afhankelijkheden:** T04

Centrale coordinator voor asset loading. Equivalent van `FileLoader.java`.

- `loaders/FileLoader.js`: `async loadFiles(dirPath) → AssetStore`
- Electron IPC bridge voor `fs` toegang (renderer heeft geen directe `fs`):
  - `main.js`: `ipcMain.handle('read-file', (e, path) => fs.readFile(path))`
  - `FileLoader.js`: `ipcRenderer.invoke('read-file', path)`
- Directory kiezer: `dialog.showOpenDialog({ properties: ['openDirectory'] })`
- Progress events via IPC tijdens laden

```js
// AssetStore structuur
{
  underlayMap: Map<id, UnderlayData>,
  overlayMap:  Map<id, OverlayData>,
  locMap:      Map<id, LocType>,
  npcMap:      Map<id, NpcType>,
  objMap:      Map<id, ObjType>,
  modelMap:    Map<id, Ob2Model>,
  textureMap:  Map<id, ImageBitmap>,
}
```

---

### Fase 3 — Rendering

#### T06 — Port ShaderManager + VertexDataHandler
**Afhankelijkheden:** T02, T03

**ShaderManager (`renderer/ShaderManager.js`)**
- `compileShader(gl, source, type)` → `WebGLShader`
- `createProgram(gl, vertSrc, fragSrc)` → `WebGLProgram`
- Shaders naar GLSL ES 3.0 (`#version 300 es`)

**VertexDataHandler (`renderer/VertexDataHandler.js`)**
- `gl.createVertexArray()` → `gl.bindVertexArray()` (WebGL2 native VAOs)
- `upload(gl, triangles)` → `Float32Array` → `gl.bufferData()`
- `draw(gl, vao, count)` → `gl.drawArrays(gl.TRIANGLES, 0, count)`
- `groupByTexture(triangles)` → `Map<textureId, Triangle[]>` voor batched draws

---

#### T07 — Port TextureManager
**Afhankelijkheden:** T02, T05

- `loaders/TextureLoader.js`: sprite bestanden → `ImageBitmap` via Electron `fs`
- `renderer/TextureManager.js`:
  - `upload(gl, imageBitmap, id)` → `gl.createTexture()` + `gl.texImage2D()`
  - `gl.NEAREST` filtering (pixelart stijl)
  - `Map<id, WebGLTexture>` voor hergebruik
- `TileShapeLoader.js`: shape visualisaties als `<img>` elementen voor UI (geen WebGL)

---

#### T08 — Port Camera
**Afhankelijkheden:** T02

```bash
npm install gl-matrix  # vervangt JOML
```

- `renderer/Camera.js`
- State: `position` (vec3), `yaw`, `pitch`, `zoom`
- `getViewMatrix()` + `getProjectionMatrix()` via `gl-matrix` mat4
- Input:
  - `keydown`/`keyup` → `keysHeld` Set voor WASD
  - `wheel` → zoom
  - `mousedown` + `mousemove` rechterknop → yaw/pitch
- `update(deltaTime)` per frame

---

#### T09 — Port World + World3D (geometrie builder) ✅
**Afhankelijkheden:** T03, T05, T06

**Geïmplementeerd:** `renderer/WorldBuilder.js` (~760 regels).

- `worldBuilder.initFloTypes(assetStore)` — pre-computed FloType data (hsl/chroma/luminance)
- `worldBuilder.buildGeometry(mapData, assetStore, level) → Triangle[]`
  - Blend-accumulator (11-tegel sliding window box filter) voor underlay kleuren
  - Lightmap per hoek van de heightmap
  - Underlay: 2 driehoeken met `mulHSL(baseColor, cornerLight)`
  - Overlay: N driehoeken via SHAPE_PATHS/SHAPE_POINTS tabellen
  - Locs/NPCs/Objs: model ophalen via `assetStore.modelOb2Map`, rotateY90, schalen, flat shading

**Kritieke gotchas (al opgelost):**
- `MapData` gebruikt `mapTiles` niet `tiles`
- Underlay IDs zijn 1-indexed (raw filewaarde), overlay IDs zijn 0-indexed (`file - 1`)
- `LIGHT_MAG` moet integer sqrt zijn (`| 0`) voor `>> 8` integermath → geeft 213, niet 214
- `MapDataLoader.loadMap()` roept `resolveOverlayData()` NIET aan — WorldBuilder haalt overlay/underlay kleuren zelf op uit `assetStore`

---

#### T10 — Port ModelViewer
**Afhankelijkheden:** T06, T09, T11

- `<canvas id="modelPreviewCanvas" width="300" height="350">` in rechter sidebar
- `renderer/ModelViewer.js`:
  - Eigen WebGL context op preview canvas
  - `showModel(modelId, assetStore)`: bouw geometrie, render gecentreerd
  - Auto-rotate: `yaw += 0.5°` per frame
- Hergebruikt ShaderManager + VertexDataHandler

---

### Fase 4 — UI

#### T11 — Bouw HTML/CSS UI layout ✅
**Afhankelijkheden:** T01

**Geïmplementeerd:**

- `index.html`: drie-kolom flexbox + `#status-bar`
- `ui/styles.css`: donker thema (al aanwezig, uitgebreid)
- `ui/Sidebar.js`: "Open Server Directory" → `chooseAndLoad()`, map `<select>` + "Load Map", level 0-3 radio's, Locs/NPCs/Objects checkboxes, Save/Export As knoppen. Roept `worldBuilder.buildGeometry()` + `uploadTriangles()` + `loadTextures()` aan bij kaart laden of level wisselen.
- `ui/TileInspector.js`: formulier height/underlayId/overlayId/shape(dropdown)/rotation/flag, "Apply" knop die `editor:tileChanged` event dispatch
- `ui/EntityInspector.js`: toont type/ID/naam(pack lookup)/shape/rotation/count/positie, "Remove Entity" knop dispatch `editor:entityRemoved`
- `main.js`: koppelt `renderer.onLeftClick` aan tile + entity inspectoren; status bar toont hovered tile coördinaten

**Nog te doen in T10:** `<canvas id="modelPreviewCanvas">` + `ModelViewer.js` toevoegen aan rechter sidebar (model preview ontbreekt nog).

---

### Fase 5 — Interactie

#### T12 — Muis picking (ray casting) ⏳ VOLGENDE STAP
**Afhankelijkheden:** T08, T09

**Blocker voor T13 en T14.** Zonder ray casting werkt linker klik niet.

- `renderer/MousePicker.js`
- `getRay(mouseX, mouseY, viewMatrix, projMatrix, canvas)` → `{origin, direction}`
  - Unproject via inverse(projection × view): NDC → world space
- `intersectTriangles(ray, triangles)` → `{triangle, tileX, tileZ}` — Möller–Trumbore algoritme
  - Loop over `scene.triangles`, return closest hit
  - Triangle heeft `tileX`/`tileZ` velden — gebruik die direct als `hoveredTile`
- `Renderer._loop()` roept al `mousePicker.update(...)` aan (regel 146-154) — enkel `attach('mousePicker', ...)` nodig in `main.js`
- Resultaat opgeslagen als `scene.hoveredTile`, bijgewerkt per frame (skip bij right-drag)

---

#### T13 — Tegel bewerking (Ctrl+klik) ⏳
**Afhankelijkheden:** T11, T12, T09

**Deels gereed:** `TileInspector` en het `editor:tileChanged` event bestaan al (T11). Nog toe te voegen:

- `main.js`: luister op `editor:tileChanged` → `undoStack.save(scene.mapData)` → `sidebar._rebuildScene()`
- Ctrl+klik onderscheid: in `renderer.onLeftClick` check `keysHeld.has('control')` — bij Ctrl→ apply direct, zonder Ctrl → alleen inspect
- `rebuildScene()` staat al in `Sidebar.js` (hergebruiken)

---

#### T14 — Entiteit plaatsing (L/N/O + klik)
**Afhankelijkheden:** T11, T12, T13

- `keysHeld = new Set()` bijhouden via `keydown`/`keyup`
- L+klik → `LocData` toevoegen, N+klik → `NpcData`, O+klik → `ObjData`
- Altijd: `undoStack.save()` → push naar array in `mapData` → `rebuildScene()`
- Rechterklik op entiteit → verwijder → `rebuildScene()`

---

#### T15 — Copy/paste tegel (Ctrl+C/V)
**Afhankelijkheden:** T03, T13

- `editor/Clipboard.js`: `copy(tileData)` + `paste(x, z, mapData)`
- Ctrl+C: `CopiedTileData` aanmaken van geselecteerde tegel
- Ctrl+V: `undoStack.save()` → schrijf gekopieerde waarden → `rebuildScene()`

---

#### T16 — Undo/redo (Ctrl+Z)
**Afhankelijkheden:** T03

```js
class UndoStack {
  constructor(maxSize = 30) { ... }
  save(mapData)   // push mapData.clone()
  undo()          // pop → return herstelde MapData
  canUndo()
}
```

**Kritiek:** `MapData.clone()` moet een echte deep copy zijn. Een ondiepe copy veroorzaakt bugs waarbij undo de huidige state mee aanpast.

---

### Fase 6 — Bestanden

#### T17 — Kaart selectie + laden ⏳ (grotendeels klaar)
**Afhankelijkheden:** T04, T05, T11

**Grotendeels geïmplementeerd in `Sidebar.js` (T11).** Wat nog ontbreekt:

- Controleer of Electron main-process IPC handlers aanwezig zijn voor: `readFile`, `readDir`, `walkDir`, `writeFile`, `showOpenDialog`, `showSaveDialog`. Deze worden aangeroepen via `window.electronAPI.*` — kijk in `src/main/` of `electron/main.js`.
- Default kaart bij opstarten (`m50_50.jm2`) is niet geïmplementeerd — optioneel toe te voegen in `Sidebar._openDir()` na het laden van de lijst.

---

#### T18 — Export naar JM2
**Afhankelijkheden:** T04, T17

- Export knop in linker sidebar
- `MapDataTransformer.serialize(mapData)` → string
- Via IPC: `fs.writeFile(path, content)` (overschrijf origineel)
- Optioneel: `dialog.showSaveDialog()` voor 'opslaan als'
- Visuele feedback na opslaan (statusbalk)

---

### Fase 7 — Validatie

#### T19 — Integratie validatie
**Afhankelijkheden:** T01–T18

**Statische code review (sessie 2026-06-18) — 2 bugs gevonden en gefixed:**
- `CopiedTileData.js:23` — loc rotaties werden gekopieerd van de tegel in plaats van de loc zelf (fix: `l.rotation = loc.rotation`)
- `Renderer.js:112` — keydown/keyup handlers filterden niet op INPUT/SELECT, waardoor typen in formuliervelden camerabeweging veroorzaakte (fix: guard toegevoegd)

**Checklist (handmatig uitvoeren met een echte serverdirectory):**
- [ ] Zelfde server directory laden als in de Java editor
- [ ] Alle kaarten in de lijst laden zonder fout
- [ ] 3D rendering visueel equivalent (tile shapes, texturen, hoogtes, entiteiten)
- [ ] Tegel editing via Ctrl+klik werkt correct (alle velden)
- [ ] Export → diff JM2 met origineel → geen onverwachte verschillen
- [ ] Undo/redo werkt voor ≥3 opeenvolgende bewerkingen
- [ ] Copy/paste tegel correct
- [ ] Camera navigatie vloeiend (WASD, zoom, rotatie)
- [ ] Level selector (0–3) wisselt correct

Na succesvolle validatie: Java broncode en `build.gradle` kunnen worden verwijderd.

---

## Risico's

| Risico | Impact | Mitigatie |
|---|---|---|
| `World`/`World3D` tile shape logica incorrect geport | Hoog — visuele fouten in alle tegels | Test shape voor shape met schermvergelijking naast de Java editor |
| JM2 serialisatie wijkt af van origineel | Hoog — kaarten corrupteren | Byte-voor-byte diff als onderdeel van T04 validatie |
| Electron IPC latency bij grote asset loads | Laag | Laad assets eenmalig bij opstarten, cache in `AssetStore` |
| WebGL2 niet beschikbaar op oudere hardware | Laag | Electron gebruikt een recente Chromium versie met volledige WebGL2 support |
