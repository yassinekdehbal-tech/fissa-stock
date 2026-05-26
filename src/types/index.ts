export interface Piece {
  _id?: string
  ref: string
  name: string
  cat: PieceCategory
  vehicle: string
  oem: string
  supplier: string
  donor: string
  qty: number
  price: number
  threshold?: number
  zone: string
  etat: PieceState
  compat: string
  photo: string
  notes: string
  fmt: 'CODE128' | 'CODE39'
  added: string
  archived: boolean
}

export type PieceCategory = 'moteur' | 'carrosserie' | 'train-avant' | 'train-arriere' | 'electronique' | 'autre' | ''

export type PieceState = 'Bon état' | 'Très bon état' | 'État moyen' | 'Pour pièces'

export interface HistoryEntry {
  _id?: string
  type: 'vente' | 'ajout' | 'modif' | 'suppression' | 'connexion'
  ref: string
  name: string
  qty?: number
  prixVente?: number
  prixCatalogue?: number
  remise?: number
  payment?: string
  client?: string
  user: string
  device?: string
  ts: number
  date: string
}

export interface User {
  _id?: string
  id: string
  name: string
  role: 'admin' | 'user'
  pwd: string
  hashed?: boolean
  perms: UserPermissions
}

export interface UserPermissions {
  magasinier?: boolean
  vendeur?: boolean
  historique?: boolean
}

export interface CartItem {
  piece: Piece
  qty: number
  prixUnitaire: number
}

export interface CategoryInfo {
  label: string
  icon: string
  color: string
  bgClass: string
  textClass: string
  borderClass: string
}

export const CATEGORIES: Record<PieceCategory, CategoryInfo> = {
  'moteur': { label: 'Moteur', icon: '🔴', color: '#f85149', bgClass: 'bg-red-500/10', textClass: 'text-red-400', borderClass: 'border-red-500/20' },
  'carrosserie': { label: 'Carrosserie', icon: '🔵', color: '#58a6ff', bgClass: 'bg-blue-400/10', textClass: 'text-blue-400', borderClass: 'border-blue-400/20' },
  'train-avant': { label: 'Train avant', icon: '🟢', color: '#3fb950', bgClass: 'bg-green-500/10', textClass: 'text-green-400', borderClass: 'border-green-500/20' },
  'train-arriere': { label: 'Train arrière', icon: '🟠', color: '#f0883e', bgClass: 'bg-orange-400/10', textClass: 'text-orange-400', borderClass: 'border-orange-400/20' },
  'electronique': { label: 'Électronique', icon: '🟣', color: '#bc8cff', bgClass: 'bg-purple-400/10', textClass: 'text-purple-400', borderClass: 'border-purple-400/20' },
  'autre': { label: 'Autre', icon: '⚫', color: '#8b949e', bgClass: 'bg-gray-500/10', textClass: 'text-gray-400', borderClass: 'border-gray-500/20' },
  '': { label: '—', icon: '', color: '#8b949e', bgClass: 'bg-gray-500/10', textClass: 'text-gray-400', borderClass: 'border-gray-500/20' }
}
