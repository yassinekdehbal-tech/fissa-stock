/**
 * Empreinte visuelle d'une image (dHash 64 bits) pour détecter deux photos
 * prises sous le même angle : l'image est réduite en 9×8 niveaux de gris et
 * chaque bit dit si un pixel est plus clair que son voisin de droite. Deux
 * photos quasi identiques ont une distance de Hamming proche de 0 ; un
 * changement d'angle réel dépasse largement le seuil.
 */
export type ImageHash = string // 64 caractères '0' / '1'

/** Distance (en bits) au-dessous de laquelle deux photos sont considérées comme le même angle. */
export const SAME_ANGLE_MAX_DISTANCE = 10

async function toBitmap(src: Blob | string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof src !== 'string') return await createImageBitmap(src)
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image illisible'))
    img.src = src
  })
}

/** Empreinte d'un fichier ou d'une URL ; `null` si l'image ne peut pas être lue (CORS, format). */
export async function imageHash(src: Blob | string): Promise<ImageHash | null> {
  try {
    const bmp = await toBitmap(src)
    const canvas = document.createElement('canvas')
    canvas.width = 9
    canvas.height = 8
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(bmp, 0, 0, 9, 8)
    const { data } = ctx.getImageData(0, 0, 9, 8)
    const gray: number[] = []
    for (let i = 0; i < data.length; i += 4) gray.push(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!)
    let bits = ''
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) bits += gray[y * 9 + x]! > gray[y * 9 + x + 1]! ? '1' : '0'
    }
    if ('close' in bmp) bmp.close()
    return bits
  } catch {
    return null
  }
}

export function hammingDistance(a: ImageHash, b: ImageHash): number {
  let d = 0
  for (let i = 0; i < a.length && i < b.length; i++) if (a[i] !== b[i]) d++
  return d
}

export function sameAngle(a: ImageHash, b: ImageHash): boolean {
  return hammingDistance(a, b) <= SAME_ANGLE_MAX_DISTANCE
}
