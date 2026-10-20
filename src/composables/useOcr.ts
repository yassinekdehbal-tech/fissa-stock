import { ref } from 'vue'

/**
 * Lecture d'une référence écrite à la main (ou imprimée) sur une photo.
 *
 * Moteur : Tesseract.js, chargé à la première utilisation (worker + modèle
 * anglais ≈ quelques Mo, puis mis en cache sur l'appareil). Le texte lu est
 * ensuite rapproché des références du stock (voir utils/refMatch.ts).
 */

type Worker = import('tesseract.js').Worker

let workerPromise: Promise<Worker> | null = null

const WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/._ '

async function getWorker(onProgress?: (p: number, status: string) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM, OEM } = await import('tesseract.js')
      const worker = await createWorker('eng', OEM.LSTM_ONLY, {
        logger: (m) => {
          if (onProgress && typeof m.progress === 'number') onProgress(m.progress, m.status)
        },
      })
      await worker.setParameters({
        tessedit_char_whitelist: WHITELIST,
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
      })
      return worker
    })().catch((e) => {
      workerPromise = null
      throw e
    })
  }
  return workerPromise
}

/**
 * Prépare la photo pour la lecture : taille raisonnable, niveaux de gris,
 * contraste renforcé (marqueur sur pièce sale ou brillante).
 */
async function prepareImage(src: Blob | string, maxSide = 1600): Promise<HTMLCanvasElement> {
  const img = new Image()
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Image illisible'))
      img.src = url
    })
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url)
  }
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas indisponible')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  const gray = new Uint8ClampedArray(px.length / 4)
  let min = 255
  let max = 0
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = (px[i]! * 299 + px[i + 1]! * 587 + px[i + 2]! * 114) / 1000
    gray[j] = g
    if (g < min) min = g
    if (g > max) max = g
  }
  const range = Math.max(1, max - min)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = ((gray[j]! - min) / range) * 255
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(data, 0, 0)
  return canvas
}

export interface OcrResult {
  text: string
  /** Confiance moyenne annoncée par le moteur (0 → 100). */
  confidence: number
}

export function useOcr() {
  const busy = ref(false)
  const progress = ref(0)
  const status = ref('')

  function describe(s: string): string {
    if (s.includes('loading tesseract core') || s.includes('initializing tesseract')) return 'Chargement du moteur de lecture…'
    if (s.includes('loading language') || s.includes('initializing api')) return 'Chargement du modèle de lecture…'
    if (s.includes('recognizing')) return 'Lecture de la référence…'
    return 'Préparation…'
  }

  async function readImage(src: Blob | string): Promise<OcrResult> {
    busy.value = true
    progress.value = 0
    status.value = 'Préparation…'
    try {
      const worker = await getWorker((p, s) => {
        progress.value = p
        status.value = describe(s)
      })
      status.value = 'Lecture de la référence…'
      const canvas = await prepareImage(src)
      const { data } = await worker.recognize(canvas)
      return { text: data.text || '', confidence: data.confidence || 0 }
    } finally {
      busy.value = false
      progress.value = 0
      status.value = ''
    }
  }

  return { busy, progress, status, readImage }
}
