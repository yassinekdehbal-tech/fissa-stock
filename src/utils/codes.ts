import type { Piece } from '@/types'

/**
 * Identification d'une pièce par n'importe lequel de ses codes.
 *
 * Une pièce peut être reconnue par :
 *  - `ref`         : référence interne, encodée dans le code-barres imprimé ;
 *  - `shortCode`   : code court écrit au marqueur sur la pièce ;
 *  - `ean`         : code-barres déjà présent sur l'emballage (pièce neuve) ;
 *  - `supplierRef` : référence fournisseur (recherche du vendeur avant commande) ;
 *  - `oem`         : n° constructeur (repli : visible sur la pièce et les sites).
 *
 * La comparaison ignore la casse, les espaces et la ponctuation, car ces codes
 * sont tapés à la main ou recopiés depuis un site fournisseur.
 */

export type CodeKind = 'ref' | 'shortCode' | 'ean' | 'supplierRef' | 'oem'

export const CODE_KIND_LABEL: Record<CodeKind, string> = {
  ref: 'Référence interne',
  shortCode: 'Code court',
  ean: 'Code-barres emballage',
  supplierRef: 'Réf. fournisseur',
  oem: 'N° OEM',
}

/** Alphabet du code court : chiffres 2-9 + lettres sans I, L, O. */
export const SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const SHORT_CODE_LENGTH = 5

/** Normalise un code saisi ou scanné : majuscules, sans espaces ni ponctuation. */
export function normalizeCode(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
}

/**
 * Variantes d'un code numérique : un UPC-A (12 chiffres) est l'EAN-13 avec un
 * 0 devant, et certaines douchettes renvoient l'un ou l'autre.
 */
function numericVariants(code: string): string[] {
  if (!/^\d+$/.test(code)) return [code]
  const out = [code]
  if (code.length === 12) out.push('0' + code)
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1))
  return out
}

export interface CodeMatch {
  piece: Piece
  kind: CodeKind
}

/**
 * Cherche les pièces correspondant exactement (après normalisation) à un code.
 * Les résultats sont triés par fiabilité du code : réf interne, code court,
 * EAN, réf fournisseur puis OEM. Plusieurs pièces peuvent partager un EAN ou
 * un OEM (même pièce neuve et d'occasion) : l'appelant tranche.
 */
export function findPiecesByCode(pieces: Piece[], raw: string): CodeMatch[] {
  const wanted = new Set(numericVariants(normalizeCode(raw)))
  wanted.delete('')
  if (!wanted.size) return []

  const order: CodeKind[] = ['ref', 'shortCode', 'ean', 'supplierRef', 'oem']
  const matches: CodeMatch[] = []
  const seen = new Set<Piece>()

  for (const kind of order) {
    for (const piece of pieces) {
      if (seen.has(piece)) continue
      const value = normalizeCode(piece[kind] || '')
      if (value && wanted.has(value)) {
        matches.push({ piece, kind })
        seen.add(piece)
      }
    }
  }
  return matches
}

/** Vrai si la recherche libre `q` (déjà en minuscules) touche un des codes. */
export function codeFieldsInclude(piece: Piece, q: string): boolean {
  const nq = normalizeCode(q)
  if (!nq) return false
  return (
    normalizeCode(piece.shortCode).includes(nq) ||
    normalizeCode(piece.ean).includes(nq) ||
    normalizeCode(piece.supplierRef).includes(nq)
  )
}
