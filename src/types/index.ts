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
  'moteur': { label: 'Moteur', icon: '', color: '#ef4444', bgClass: 'bg-red-50', textClass: 'text-red-700', borderClass: 'border-red-200' },
  'carrosserie': { label: 'Carrosserie', icon: '', color: '#3b82f6', bgClass: 'bg-blue-50', textClass: 'text-blue-700', borderClass: 'border-blue-200' },
  'train-avant': { label: 'Train avant', icon: '', color: '#22c55e', bgClass: 'bg-green-50', textClass: 'text-green-700', borderClass: 'border-green-200' },
  'train-arriere': { label: 'Train arrière', icon: '', color: '#f97316', bgClass: 'bg-orange-50', textClass: 'text-orange-700', borderClass: 'border-orange-200' },
  'electronique': { label: 'Électronique', icon: '', color: '#8b5cf6', bgClass: 'bg-violet-50', textClass: 'text-violet-700', borderClass: 'border-violet-200' },
  'autre': { label: 'Autre', icon: '', color: '#6b7280', bgClass: 'bg-gray-100', textClass: 'text-gray-600', borderClass: 'border-gray-200' },
  '': { label: '—', icon: '', color: '#6b7280', bgClass: 'bg-gray-100', textClass: 'text-gray-600', borderClass: 'border-gray-200' }
}

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
