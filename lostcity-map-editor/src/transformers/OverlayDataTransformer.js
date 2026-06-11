// Resolves color/texture/occlude on an OverlayData instance using the loaded FLO maps.
// Pure function — no global state, unlike the Java version which called FileLoader directly.

export function resolveOverlayData(overlayData, floMap, underlayMap, overlayMap) {
  const floName = floMap.get(overlayData.id)

  // occlude
  const overlayEntry = overlayMap.get(floName)
  if (overlayEntry != null && overlayEntry.occlude != null) {
    overlayData.occlude = overlayEntry.occlude
  }

  // color / texture
  const underlayColor = underlayMap.get(floName)
  if (underlayColor != null) {
    overlayData.color = underlayColor
  } else {
    overlayData.color = 0
    if (overlayEntry != null) {
      if (overlayEntry.rgb != null) {
        overlayData.color = overlayEntry.rgb
      } else if (overlayEntry.texture != null) {
        overlayData.texture = overlayEntry.texture + '.png'
      }
    }
  }
}
