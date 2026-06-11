// Loads tile shape preview images (Shape-0.png … Shape-11.png) from the Vite public folder.
// PNGs must be placed at public/Data/TileShapes/ — matches Java classpath resource path.
// Returns Map<shapeId (0–11), HTMLImageElement> for use by the tile inspector (T11).
export function loadShapeImages() {
  const shapeImages = new Map()
  for (let i = 0; i <= 11; i++) {
    const img = new Image()
    img.src   = `./Data/TileShapes/Shape-${i}.png`
    shapeImages.set(i, img)
  }
  return shapeImages
}
