import type { Piece } from '@/types'

/**
 * Rapprochement tolérant de références.
 *
 * Sert quand la lecture n'est pas sûre : référence écrite à la main lue par
 * OCR, saisie approximative, code-barres abîmé. On compare le texte lu aux
 * références (et n° OEM) du stock avec une distance d'édition pondérée : les
 * confusions classiques (O/0, I/1, S/5, B/8…) coûtent moins cher qu'une vraie
 * erreur, pour que « M0TEUR-O01 » reste proche de « MOTEUR-001 ».
 */

/** Caractères souvent confondus à la lecture (manuscrit ou OCR). */
const CONFUSABLE: Record<string, string> = {
  O: '0', Q: '0', D: '0', U: '0',
  I: '1', L: '1', J: '1',
  Z: '2',
  S: '5',
  G: '6', C: '6',
  T: '7',
  B: '8',
  A: '4',
  E: '3',
}

/** Majuscules, sans séparateurs ni espaces : seule la suite de caractères compte. */
export function normalizeRef(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function canonChar(c: string): string {
  return CONFUSABLE[c] ?? c
}

/** Distance d'édition pondérée entre deux chaînes déjà normalisées. */
function distance(a: string, b: string): number {
  const n = a.length
  const m = b.length
  if (!n) return m
  if (!m) return n
  let prev = new Array<number>(m + 1)
  let cur = new Array<number>(m + 1)
  for (let j = 0; j <= m; j++) prev[j] = j
  for (let i = 1; i <= n; i++) {
    cur[0] = i
    const ca = a[i - 1]!
    for (let j = 1; j <= m; j++) {
      const cb = b[j - 1]!
      let sub: number
      if (ca === cb) sub = 0
      else if (canonChar(ca) === canonChar(cb)) sub = 0.35
      else sub = 1
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + sub)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[m]!
}

/** Score de ressemblance entre 0 (rien à voir) et 1 (identique). */
export function similarity(input: string, candidate: string): number {
  const a = normalizeRef(input)
  const b = normalizeRef(candidate)
  if (!a || !b) return 0
  if (a === b) return 1
  // Lecture partielle : la référence contient ce qui a été lu (ou l'inverse)
  if (a.length >= 4 && (b.includes(a) || a.includes(b))) {
    return 0.6 + 0.3 * (Math.min(a.length, b.length) / Math.max(a.length, b.length))
  }
  const d = distance(a, b)
  return Math.max(0, 1 - d / Math.max(a.length, b.length))
}

export interface RefSuggestion {
  piece: Piece
  /** 0 → 1 */
  score: number
  /** Champ qui a été reconnu. */
  field: 'ref' | 'oem'
  /** Texte lu ayant produit ce rapprochement. */
  input: string
}

/** Seuil minimal pour qu'une pièce soit proposée. */
export const SUGGEST_MIN_SCORE = 0.55

/**
 * Pièces les plus proches des textes lus (plusieurs lectures possibles :
 * mots, lignes…). Une pièce n'apparaît qu'une fois, avec son meilleur score.
 */
export function suggestPieces(pieces: Piece[], inputs: string[], limit = 5): RefSuggestion[] {
  const seen = new Map<string, RefSuggestion>()
  const cleaned = Array.from(new Set(inputs.map((s) => normalizeRef(s)).filter((s) => s.length >= 2)))
  for (const p of pieces) {
    if (p.archived) continue
    for (const input of cleaned) {
      const fields: Array<['ref' | 'oem', string]> = [['ref', p.ref]]
      if (p.oem) fields.push(['oem', p.oem])
      for (const [field, value] of fields) {
        const score = similarity(input, value)
        if (score < SUGGEST_MIN_SCORE) continue
        const id = p._id ?? p.ref
        const prev = seen.get(id)
        if (!prev || score > prev.score) seen.set(id, { piece: p, score, field, input })
      }
    }
  }
  return Array.from(seen.values())
    .sort((x, y) => y.score - x.score || x.piece.ref.localeCompare(y.piece.ref))
    .slice(0, limit)
}

/** Pièce dont la référence (ou l'OEM) correspond exactement au texte lu, séparateurs ignorés. */
export function findExact(pieces: Piece[], input: string): Piece | undefined {
  const n = normalizeRef(input)
  if (!n) return undefined
  return pieces.find((p) => !p.archived && (normalizeRef(p.ref) === n || (p.oem && normalizeRef(p.oem) === n)))
}

/**
 * Découpe un texte OCR en lectures candidates : mots, lignes sans espaces
 * (« R9M 001 » → « R9M001 ») — les séparateurs sont de toute façon ignorés.
 */
export function ocrCandidates(text: string): string[] {
  const out: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    out.push(line)
    for (const word of line.split(/\s+/)) out.push(word)
  }
  return Array.from(new Set(out.map((s) => s.trim()).filter((s) => normalizeRef(s).length >= 2)))
}

/** Libellé lisible d'un score. */
export function scoreLabel(score: number): { text: string; cls: string } {
  if (score >= 0.999) return { text: 'Identique', cls: 'badge-green' }
  if (score >= 0.8) return { text: 'Très proche', cls: 'badge-green' }
  if (score >= 0.65) return { text: 'Proche', cls: 'badge-amber' }
  return { text: 'Possible', cls: 'badge-gray' }
}
