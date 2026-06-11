import { MapData }     from '../data/MapData.js'
import { TileData }    from '../data/TileData.js'
import { OverlayData } from '../data/OverlayData.js'
import { UnderlayData } from '../data/UnderlayData.js'
import { LocData }     from '../data/LocData.js'
import { NpcData }     from '../data/NpcData.js'
import { ObjData }     from '../data/ObjData.js'
import { perlinNoise } from '../util/perlinNoise.js'

function parseIntOrNull(s) {
  if (s == null) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

// Parse a JM2 map file. filePath is used only to extract baseX/baseY from the filename.
export function parseJM2(text, filePath = '') {
  const map = new MapData()

  let baseX = 0
  let baseY = 0
  const fnMatch = (filePath.replace(/\\/g, '/')).match(/m(\d+)_(\d+)\.jm2/i)
  if (fnMatch) {
    baseX = parseInt(fnMatch[1], 10)
    baseY = parseInt(fnMatch[2], 10)
  }

  let section = null
  // Regex mirrors Java: (h(\d+))|(o(\d+))|(r(\d+))|(f(\d+))|(u(\d+))|(\d+)
  const TOKEN_RE = /h(\d+)|o(\d+)|r(\d+)|f(\d+)|u(\d+)|(\d+)/g

  for (const raw of text.split('\n')) {
    const line = raw.trim()

    if (line === '==== MAP ====') { section = 'MAP'; continue }
    if (line === '==== LOC ====') { section = 'LOC'; continue }
    if (line === '==== NPC ====') { section = 'NPC'; continue }
    if (line === '==== OBJ ====') { section = 'OBJ'; continue }
    if (line.startsWith('==='))   { section = null;  continue }
    if (!line || line.startsWith('//') || section == null) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue

    const coords = line.slice(0, colon).trim().split(' ')
    if (coords.length !== 3) continue

    const level = parseInt(coords[0], 10)
    const x     = parseInt(coords[1], 10)
    const z     = parseInt(coords[2], 10)
    const data  = line.slice(colon + 1).trim()

    try {
      if (section === 'MAP') {
        const tile = new TileData(level, x, z)
        let shapeTemp = null
        TOKEN_RE.lastIndex = 0

        let m
        while ((m = TOKEN_RE.exec(data)) !== null) {
          if (m[1] != null) {
            // h<n> → height
            const h = parseInt(m[1], 10)
            if (level === 0) {
              tile.height = h * -8
            } else if (h !== 1) {
              tile.height = h * -8
            } else {
              tile.height = 1
            }
          } else if (m[2] != null) {
            // o<n> → overlay (id is 1-based in file, 0-based internally)
            tile.overlay = new OverlayData(parseInt(m[2], 10) - 1)
          } else if (m[3] != null) {
            // r<n> → explicit rotation prefix
            tile.rotation = parseInt(m[3], 10)
          } else if (m[4] != null) {
            // f<n> → flag
            tile.flag = parseInt(m[4], 10)
          } else if (m[5] != null) {
            // u<n> → underlay
            tile.underlay = new UnderlayData(parseInt(m[5], 10))
          } else if (m[6] != null) {
            // bare number: first = shape, second = rotation
            if (shapeTemp == null) {
              shapeTemp = parseInt(m[6], 10)
            } else {
              tile.rotation = parseInt(m[6], 10)
            }
          }
        }

        // Post-processing matches Java logic exactly:
        if (tile.height === 0 && tile.level === 0) {
          const worldX = baseX * 64 + x + 932731
          const worldZ = baseY * 64 + z + 556238
          tile.perlin  = true
          tile.height  = perlinNoise(worldX, worldZ) * -8
        } else if (tile.height === 0) {
          tile.perlin = true
          // height stays 0
        } else if (tile.height === 1) {
          tile.height = 0
        }

        tile.shape = shapeTemp
        map.mapTiles[level][x][z] = tile

      } else if (section === 'LOC') {
        const parts = data.split(' ')
        if (parts.length < 2) continue
        const id    = parseIntOrNull(parts[0])
        const shape = parseIntOrNull(parts[1])
        if (id == null || shape == null) continue
        const loc = new LocData(level, x, z, id, shape)
        loc.rotation = parts.length > 2 ? (parseIntOrNull(parts[2]) ?? 0) : 0
        map.locations.push(loc)

      } else if (section === 'NPC') {
        const parts = data.split(' ')
        if (parts.length !== 1) continue
        const npcId = parseIntOrNull(parts[0])
        if (npcId == null) continue
        map.npcs.push(new NpcData(level, x, z, npcId))

      } else if (section === 'OBJ') {
        const parts = data.split(' ')
        if (parts.length > 2) continue
        const objId    = parseIntOrNull(parts[0])
        const objCount = parseIntOrNull(parts[1])
        if (objId == null) continue
        map.objects.push(new ObjData(level, x, z, objId, objCount))
      }
    } catch (e) {
      console.warn('Error parsing JM2 line:', line, e)
    }
  }

  return map
}

// Serialise a MapData back to JM2 text format — mirrors writeJM2File in Java.
export function serializeJM2(mapData) {
  const lines = ['==== MAP ====']

  for (let level = 0; level < mapData.mapTiles.length; level++) {
    for (let x = 0; x < mapData.mapTiles[level].length; x++) {
      for (let z = 0; z < mapData.mapTiles[level][x].length; z++) {
        const tile = mapData.mapTiles[level][x][z]
        if (tile == null) continue

        let data = ''
        if (tile.height != null && tile.height !== 0 && !tile.perlin) {
          data += ` h${tile.height / -8}`
        } else if (tile.height != null && tile.height === 0 && !tile.perlin) {
          data += ' h1'
        }
        if (tile.overlay != null) {
          data += ` o${tile.overlay.id + 1}`
        }
        if (tile.shape != null && tile.shape !== 0) {
          data += `;${tile.shape}`
          if (tile.rotation != null && tile.rotation !== 0) {
            data += `;${tile.rotation}`
          }
        }
        if (tile.flag != null && tile.flag !== 0) {
          data += ` f${tile.flag}`
        }
        if (tile.underlay != null) {
          data += ` u${tile.underlay.id}`
        }

        lines.push(`${tile.level} ${tile.x} ${tile.z}:${data}`)
      }
    }
  }

  lines.push('', '==== LOC ====')
  for (const loc of mapData.locations) {
    const rot = (loc.rotation != null && loc.rotation !== 0) ? ` ${loc.rotation}` : ''
    lines.push(`${loc.level} ${loc.x} ${loc.z}: ${loc.id} ${loc.shape}${rot}`)
  }

  lines.push('', '==== NPC ====')
  for (const npc of mapData.npcs) {
    lines.push(`${npc.level} ${npc.x} ${npc.z}: ${npc.id}`)
  }

  lines.push('', '==== OBJ ====')
  for (const obj of mapData.objects) {
    lines.push(`${obj.level} ${obj.x} ${obj.z}: ${obj.id} ${obj.count}`)
  }

  return lines.join('\n') + '\n'
}
