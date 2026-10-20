export type PieceSource = 'don' | 'demontage' | 'lot-occasion' | 'grossiste-neuf' | 'web' | 'autre'

export interface Piece {
  _id?: string
  ref: string
  name: string
  cat: PieceCategory
  vehicle: string
  oem: string
  supplier: string
  donor: string
  source: PieceSource
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
  publishable?: boolean
}

/** Clé d'une catégorie (paramétrée par l'administrateur, table `categories`). */
export type PieceCategory = string

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

/** Catégorie de pièce telle que gérée par l'administrateur. */
export interface Category {
  id: string
  key: string
  label: string
  /** 2 lettres majuscules sûres (sans I, O, Q) : préfixe des références générées. */
  code: string
  color: CategoryColor
  sort: number
  archived: boolean
}

export type CategoryColor = 'red' | 'blue' | 'green' | 'orange' | 'violet' | 'amber' | 'teal' | 'pink' | 'gray'

/** Palette des catégories (classes écrites en toutes lettres pour Tailwind). */
export const CATEGORY_COLORS: Record<CategoryColor, Omit<CategoryInfo, 'label' | 'icon'>> = {
  red:    { color: '#ef4444', bgClass: 'bg-red-50',    textClass: 'text-red-700',    borderClass: 'border-red-200' },
  blue:   { color: '#3b82f6', bgClass: 'bg-blue-50',   textClass: 'text-blue-700',   borderClass: 'border-blue-200' },
  green:  { color: '#22c55e', bgClass: 'bg-green-50',  textClass: 'text-green-700',  borderClass: 'border-green-200' },
  orange: { color: '#f97316', bgClass: 'bg-orange-50', textClass: 'text-orange-700', borderClass: 'border-orange-200' },
  violet: { color: '#8b5cf6', bgClass: 'bg-violet-50', textClass: 'text-violet-700', borderClass: 'border-violet-200' },
  amber:  { color: '#f59e0b', bgClass: 'bg-amber-50',  textClass: 'text-amber-700',  borderClass: 'border-amber-200' },
  teal:   { color: '#14b8a6', bgClass: 'bg-teal-50',   textClass: 'text-teal-700',   borderClass: 'border-teal-200' },
  pink:   { color: '#ec4899', bgClass: 'bg-pink-50',   textClass: 'text-pink-700',   borderClass: 'border-pink-200' },
  gray:   { color: '#6b7280', bgClass: 'bg-gray-100',  textClass: 'text-gray-600',   borderClass: 'border-gray-200' },
}

/** Apparence d'une catégorie inconnue ou absente. */
export const UNKNOWN_CATEGORY: CategoryInfo = { label: '—', icon: '', ...CATEGORY_COLORS.gray }

export type InterventionStatus = 'todo' | 'in_progress' | 'done'

export interface InterventionPart {
  id?: string
  pieceId: string
  ref: string
  name: string
  qty: number
  prixUnitaire: number
}

export interface Intervention {
  _id?: string
  clientName: string
  clientPhone: string
  clientEmail: string
  vehicleMake: string
  vehicleModel: string
  vehiclePlate: string
  description: string
  notes: string
  status: InterventionStatus
  parts: InterventionPart[]
  estimatedTotal: number
  dateScheduled: string
  dateCreated: string
  dateUpdated: string
  dateDone?: string
}
