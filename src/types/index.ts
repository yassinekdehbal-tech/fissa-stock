export type PieceSource = 'don' | 'demontage' | 'reutilisation' | 'lot-occasion' | 'grossiste-neuf' | 'web' | 'autre'

/** Pièce neuve (achetée à un fournisseur pour la revente) ou d'occasion (don, démontage, réutilisation…). */
export type PieceCondition = 'neuve' | 'occasion'

/** Provenances proposées selon le type de pièce. */
export const SOURCES_BY_CONDITION: Record<PieceCondition, PieceSource[]> = {
  neuve: ['grossiste-neuf', 'web'],
  occasion: ['demontage', 'don', 'reutilisation', 'lot-occasion', 'autre'],
}
export const SOURCE_LABELS: Record<PieceSource, string> = {
  demontage: 'Démontage', don: 'Don', reutilisation: 'Réutilisation', 'lot-occasion': "Lot d'occasion",
  'grossiste-neuf': 'Grossiste / fournisseur', web: 'Achat web', autre: 'Autre',
}

/** Photos guidées à la prise de vue : 3 angles différents obligatoires pour une pièce d'occasion. */
export const PHOTO_SLOTS: Record<PieceCondition, { label: string; hint: string; required: boolean }[]> = {
  occasion: [
    { label: "Vue d'ensemble", hint: 'La pièce entière, de face', required: true },
    { label: 'Autre angle', hint: 'Dos, côté ou dessous', required: true },
    { label: 'Référence / défauts', hint: 'Étiquette, gravure, usure visible', required: true },
  ],
  neuve: [
    { label: 'Produit', hint: 'Emballage ou pièce', required: false },
  ],
}

export interface Piece {
  _id?: string
  ref: string
  name: string
  cat: PieceCategory
  /** Sous-catégorie (libellé libre, proposé depuis la table `subcategories`). */
  subcat: string
  vehicle: string
  oem: string
  /** Référence article chez le fournisseur (celle que donne son site / sa facture). */
  supplierRef: string
  /** Code-barres fournisseur (EAN) lu sur l'emballage. */
  ean: string
  /** Références associées au fil des ventes (autres OEM, réf. d'autres fournisseurs). */
  altRefs: string[]
  supplier: string
  donor: string
  source: PieceSource
  condition: PieceCondition
  qty: number
  price: number
  threshold?: number
  zone: string
  etat: PieceState
  compat: string
  /** Photo principale (= première de `photos`, conservée pour les écrans existants). */
  photo: string
  photos: string[]
  notes: string
  fmt: 'CODE128' | 'CODE39'
  added: string
  archived: boolean
  publishable?: boolean
}

/** Clé d'une catégorie (paramétrée par l'administrateur, table `categories`). */
export type PieceCategory = string

export type PieceState = 'Neuf' | 'Bon état' | 'Très bon état' | 'État moyen' | 'Pour pièces'

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

/** Fournisseur de pièces neuves (table `suppliers`). */
export interface Supplier {
  id: string
  name: string
  website: string
  phone: string
  notes: string
  sort: number
  archived: boolean
  /** Lien de recherche sur le site du fournisseur, `{ref}` remplacé par la référence. */
  searchUrl: string
  /** Correspondance des colonnes du dernier fichier tarif importé. */
  importMapping: Record<string, string>
  catalogImportedAt: string | null
}

/** Ligne d'un catalogue (tarif) fournisseur importé. */
export interface SupplierCatalogHit {
  id: string
  supplierId: string
  supplierName: string
  searchUrl: string
  ref: string
  ean: string
  label: string
  family: string
  pricePublic: number | null
  priceNet: number | null
  discount: number | null
  match: 'ref' | 'ean' | 'ref-prefix' | 'label'
}

/** Sous-catégorie d'une catégorie (table `subcategories`). */
export interface Subcategory {
  id: string
  cat: string
  label: string
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
