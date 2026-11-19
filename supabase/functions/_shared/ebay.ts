// Connecteur eBay (Sell APIs) partagé par `publish-listing` et `marketplace-orders`.
//
// Authentification : un jeton utilisateur eBay. Deux façons de le fournir
// (Dashboard Supabase → Edge Functions → Secrets) :
//   - durable : EBAY_CLIENT_ID + EBAY_CLIENT_SECRET + EBAY_REFRESH_TOKEN
//     (le jeton d'accès, valable 2 h, est régénéré à chaque appel) ;
//   - dépannage : EBAY_OAUTH_TOKEN (jeton d'accès brut, expire vite).
// EBAY_ENV=sandbox bascule sur le bac à sable eBay.
//
// Paramètres d'annonce : `sales_channels.config` (jsonb) du canal eBay, avec
// repli sur des secrets :
//   marketplaceId (EBAY_FR), categoryId / categoryByCat {cat: id},
//   fulfillmentPolicyId, paymentPolicyId, returnPolicyId, merchantLocationKey.
export interface EbayConfig {
  marketplaceId: string
  categoryId: string
  categoryByCat: Record<string, string>
  fulfillmentPolicyId: string
  paymentPolicyId: string
  returnPolicyId: string
  merchantLocationKey: string
}

export type PieceRow = Record<string, unknown>

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.account',
].join(' ')

function env(name: string): string {
  return (Deno.env.get(name) ?? '').trim()
}

export function ebayBase(): string {
  return env('EBAY_ENV') === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
}

/** Vrai si un moyen d'authentification eBay est configuré. */
export function ebayConfigured(): boolean {
  return !!env('EBAY_OAUTH_TOKEN') || (!!env('EBAY_CLIENT_ID') && !!env('EBAY_CLIENT_SECRET') && !!env('EBAY_REFRESH_TOKEN'))
}

export function readConfig(channelConfig: unknown): EbayConfig {
  const c = (channelConfig && typeof channelConfig === 'object' ? channelConfig : {}) as Record<string, unknown>
  const s = (k: string, e: string) => (typeof c[k] === 'string' && (c[k] as string).trim()) || env(e)
  return {
    marketplaceId: s('marketplaceId', 'EBAY_MARKETPLACE_ID') || 'EBAY_FR',
    categoryId: s('categoryId', 'EBAY_CATEGORY_ID'),
    categoryByCat: (c.categoryByCat && typeof c.categoryByCat === 'object' ? c.categoryByCat : {}) as Record<string, string>,
    fulfillmentPolicyId: s('fulfillmentPolicyId', 'EBAY_FULFILLMENT_POLICY_ID'),
    paymentPolicyId: s('paymentPolicyId', 'EBAY_PAYMENT_POLICY_ID'),
    returnPolicyId: s('returnPolicyId', 'EBAY_RETURN_POLICY_ID'),
    merchantLocationKey: s('merchantLocationKey', 'EBAY_MERCHANT_LOCATION_KEY'),
  }
}

/** Ce qui manque pour publier (liste vide = prêt). */
export function missingForPublish(cfg: EbayConfig): string[] {
  const missing: string[] = []
  if (!ebayConfigured()) missing.push('jeton eBay (EBAY_REFRESH_TOKEN + EBAY_CLIENT_ID/SECRET)')
  if (!cfg.categoryId && !Object.keys(cfg.categoryByCat).length) missing.push('catégorie eBay (categoryId)')
  if (!cfg.fulfillmentPolicyId) missing.push('politique de livraison (fulfillmentPolicyId)')
  if (!cfg.paymentPolicyId) missing.push('politique de paiement (paymentPolicyId)')
  if (!cfg.returnPolicyId) missing.push('politique de retour (returnPolicyId)')
  if (!cfg.merchantLocationKey) missing.push("lieu d'expédition (merchantLocationKey)")
  return missing
}

let cachedToken: { value: string; exp: number } | null = null

export async function accessToken(): Promise<string> {
  const raw = env('EBAY_OAUTH_TOKEN')
  const id = env('EBAY_CLIENT_ID')
  const secret = env('EBAY_CLIENT_SECRET')
  const refresh = env('EBAY_REFRESH_TOKEN')
  if (!(id && secret && refresh)) {
    if (raw) return raw
    throw new Error('eBay non configuré (jeton manquant)')
  }
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value
  const res = await fetch(`${ebayBase()}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${id}:${secret}`),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, scope: SCOPES }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error('eBay : renouvellement du jeton refusé (' + (data.error_description ?? data.error ?? res.status) + ')')
  }
  cachedToken = { value: data.access_token, exp: Date.now() + (Number(data.expires_in) || 7200) * 1000 }
  return cachedToken.value
}

export class EbayError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Appel API eBay avec jeton, langue et lecture des erreurs eBay. */
export async function ebayFetch(path: string, init: RequestInit & { marketplaceId?: string } = {}): Promise<{ status: number; data: Record<string, unknown> }> {
  const token = await accessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Content-Language': 'fr-FR',
    'Accept-Language': 'fr-FR',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (init.marketplaceId) headers['X-EBAY-C-MARKETPLACE-ID'] = init.marketplaceId
  const res = await fetch(ebayBase() + path, { ...init, headers })
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!res.ok) {
    const errs = (data.errors as { message?: string; longMessage?: string }[] | undefined) ?? []
    const msg = errs.map((e) => e.longMessage || e.message).filter(Boolean).join(' · ') || `HTTP ${res.status}`
    throw new EbayError(res.status, 'eBay : ' + msg)
  }
  return { status: res.status, data }
}

/** SKU eBay = référence interne (lettres, chiffres, - et _ ; 50 max). */
export function skuFor(piece: PieceRow): string {
  const base = String(piece.ref ?? '').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 50)
  return base || String(piece.id).slice(0, 50)
}

const CONDITIONS: Record<string, string> = {
  'Neuf': 'NEW',
  'Très bon état': 'USED_EXCELLENT',
  'Bon état': 'USED_GOOD',
  'État moyen': 'USED_ACCEPTABLE',
  'Pour pièces': 'FOR_PARTS_OR_NOT_WORKING',
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function listingTitle(piece: PieceRow): string {
  const parts = [piece.name, piece.vehicle].filter((x) => x && String(x).trim())
  return parts.join(' - ').slice(0, 80)
}

export function listingDescription(piece: PieceRow): string {
  const rows: [string, unknown][] = [
    ['Référence', piece.ref],
    ['État', piece.etat],
    ['Véhicule(s) compatible(s)', piece.vehicle],
    ['N° OEM', piece.oem],
    ['Compatibilités', piece.compat],
  ]
  const lines = rows.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `<li><b>${esc(k)}</b> : ${esc(v)}</li>`)
  const notes = piece.notes ? `<p>${esc(piece.notes)}</p>` : ''
  const footer = piece.condition === 'neuve'
    ? "Pièce neuve, vendue par un professionnel. Vérifiez la compatibilité avec votre véhicule avant l'achat."
    : "Pièce d'occasion contrôlée, vendue par un professionnel. Vérifiez la compatibilité avec votre véhicule avant l'achat."
  return `<h3>${esc(piece.name)}</h3><ul>${lines.join('')}</ul>${notes}<p>${footer}</p>`
}

/** Crée ou met à jour l'article d'inventaire eBay (fiche produit + quantité). */
export async function upsertInventoryItem(piece: PieceRow, sku: string, cfg: EbayConfig): Promise<void> {
  const aspects: Record<string, string[]> = {}
  if (piece.oem) aspects['Numéro de pièce fabricant'] = [String(piece.oem)]
  if (piece.supplier) aspects['Marque'] = [String(piece.supplier)]
  const photos = Array.isArray(piece.photos) && (piece.photos as string[]).length ? (piece.photos as string[]) : piece.photo ? [String(piece.photo)] : []
  const body = {
    availability: { shipToLocationAvailability: { quantity: Math.max(1, Number(piece.qty) || 1) } },
    condition: piece.condition === 'neuve' ? 'NEW' : (CONDITIONS[String(piece.etat)] ?? 'USED_GOOD'),
    product: {
      title: listingTitle(piece),
      description: listingDescription(piece),
      imageUrls: photos.slice(0, 12),
      ...(piece.oem ? { mpn: String(piece.oem) } : {}),
      ...(piece.supplier ? { brand: String(piece.supplier) } : {}),
      ...(Object.keys(aspects).length ? { aspects } : {}),
    },
  }
  await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    marketplaceId: cfg.marketplaceId,
  })
}

interface Offer { offerId: string; status?: string; listing?: { listingId?: string } }

export async function findOffer(sku: string, cfg: EbayConfig): Promise<Offer | null> {
  try {
    const { data } = await ebayFetch(`/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${cfg.marketplaceId}`, { marketplaceId: cfg.marketplaceId })
    const offers = (data.offers as Offer[] | undefined) ?? []
    return offers[0] ?? null
  } catch (e) {
    if (e instanceof EbayError && e.status === 404) return null
    throw e
  }
}

/** Publie (ou republie) la pièce : inventaire → offre → publication. */
export async function publishPiece(piece: PieceRow, channelConfig: unknown): Promise<{ listingId: string; offerId: string; url: string; sku: string }> {
  const cfg = readConfig(channelConfig)
  const missing = missingForPublish(cfg)
  if (missing.length) throw new Error('eBay non configuré : ' + missing.join(', '))
  const sku = skuFor(piece)
  await upsertInventoryItem(piece, sku, cfg)

  const categoryId = cfg.categoryByCat[String(piece.cat ?? '')] || cfg.categoryId
  const offerBody = {
    sku,
    marketplaceId: cfg.marketplaceId,
    format: 'FIXED_PRICE',
    availableQuantity: Math.max(1, Number(piece.qty) || 1),
    categoryId,
    listingDescription: listingDescription(piece),
    listingPolicies: {
      fulfillmentPolicyId: cfg.fulfillmentPolicyId,
      paymentPolicyId: cfg.paymentPolicyId,
      returnPolicyId: cfg.returnPolicyId,
    },
    pricingSummary: { price: { value: Number(piece.price).toFixed(2), currency: 'EUR' } },
    merchantLocationKey: cfg.merchantLocationKey,
  }

  let offer = await findOffer(sku, cfg)
  if (offer) {
    await ebayFetch(`/sell/inventory/v1/offer/${offer.offerId}`, { method: 'PUT', body: JSON.stringify(offerBody), marketplaceId: cfg.marketplaceId })
  } else {
    const { data } = await ebayFetch('/sell/inventory/v1/offer', { method: 'POST', body: JSON.stringify(offerBody), marketplaceId: cfg.marketplaceId })
    offer = { offerId: String(data.offerId) }
  }

  let listingId = offer.listing?.listingId ?? ''
  if (offer.status !== 'PUBLISHED' || !listingId) {
    const { data } = await ebayFetch(`/sell/inventory/v1/offer/${offer.offerId}/publish`, { method: 'POST', marketplaceId: cfg.marketplaceId })
    listingId = String(data.listingId ?? '')
  }
  const host = env('EBAY_ENV') === 'sandbox' ? 'https://sandbox.ebay.fr' : 'https://www.ebay.fr'
  return { listingId, offerId: offer.offerId, url: listingId ? `${host}/itm/${listingId}` : '', sku }
}

/** Retire l'annonce (l'offre reste en brouillon, republiable). */
export async function withdrawPiece(piece: PieceRow, channelConfig: unknown): Promise<void> {
  const cfg = readConfig(channelConfig)
  const offer = await findOffer(skuFor(piece), cfg)
  if (!offer || offer.status !== 'PUBLISHED') return
  await ebayFetch(`/sell/inventory/v1/offer/${offer.offerId}/withdraw`, { method: 'POST', marketplaceId: cfg.marketplaceId })
}

// --- Configuration du compte vendeur (Account / Inventory location) ---------
export interface PolicySummary { id: string; name: string }
export interface SellerSetup {
  fulfillment: PolicySummary[]
  payment: PolicySummary[]
  returns: PolicySummary[]
  locations: { key: string; name: string; status?: string }[]
}

/** Politiques de vente (livraison, paiement, retours) et lieux d'expédition du compte. */
export async function readSellerSetup(marketplaceId: string): Promise<SellerSetup> {
  const pol = async (path: string, key: string, idKey: string): Promise<PolicySummary[]> => {
    const { data } = await ebayFetch(`/sell/account/v1/${path}?marketplace_id=${marketplaceId}`)
    return (((data[key] as Record<string, unknown>[] | undefined) ?? [])).map((p) => ({ id: String(p[idKey]), name: String(p.name ?? '') }))
  }
  const [fulfillment, payment, returns] = await Promise.all([
    pol('fulfillment_policy', 'fulfillmentPolicies', 'fulfillmentPolicyId'),
    pol('payment_policy', 'paymentPolicies', 'paymentPolicyId'),
    pol('return_policy', 'returnPolicies', 'returnPolicyId'),
  ])
  const { data: loc } = await ebayFetch('/sell/inventory/v1/location?limit=100')
  const locations = (((loc.locations as Record<string, unknown>[] | undefined) ?? [])).map((l) => ({
    key: String(l.merchantLocationKey),
    name: String(l.name ?? ''),
    status: l.merchantLocationStatus ? String(l.merchantLocationStatus) : undefined,
  }))
  return { fulfillment, payment, returns, locations }
}

/** Active la gestion des politiques de vente par l'API (sans effet si déjà fait). */
export async function optInBusinessPolicies(): Promise<void> {
  try {
    await ebayFetch('/sell/account/v1/program/opt_in', { method: 'POST', body: JSON.stringify({ programType: 'SELLING_POLICY_MANAGEMENT' }) })
  } catch (e) {
    // Déjà activé → eBay renvoie une erreur 400 explicite, sans conséquence
    if (!(e instanceof EbayError && (e.status === 400 || e.status === 409))) throw e
  }
}

/** Crée le lieu d'expédition (magasin) utilisé par les annonces. */
export async function createLocation(key: string, loc: { name: string; addressLine1: string; city: string; postalCode: string; country?: string; phone?: string }): Promise<void> {
  await ebayFetch(`/sell/inventory/v1/location/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: JSON.stringify({
      name: loc.name,
      merchantLocationStatus: 'ENABLED',
      locationTypes: ['WAREHOUSE', 'STORE'],
      location: { address: { addressLine1: loc.addressLine1, city: loc.city, postalCode: loc.postalCode, country: loc.country ?? 'FR' } },
      ...(loc.phone ? { phone: loc.phone } : {}),
    }),
  })
}

// --- Commandes (Fulfillment API) -------------------------------------------
export interface EbayLineItem {
  lineItemId: string
  legacyItemId?: string
  sku?: string
  title?: string
  quantity: number
  lineItemCost?: { value: string }
  total?: { value: string }
}
export interface EbayOrder {
  orderId: string
  creationDate: string
  orderPaymentStatus?: string
  orderFulfillmentStatus?: string
  buyer?: { username?: string }
  pricingSummary?: { total?: { value: string } }
  lineItems: EbayLineItem[]
  fulfillmentStartInstructions?: {
    shippingStep?: {
      shipTo?: {
        fullName?: string
        email?: string
        primaryPhone?: { phoneNumber?: string }
        contactAddress?: { addressLine1?: string; addressLine2?: string; city?: string; postalCode?: string; stateOrProvince?: string; countryCode?: string }
      }
    }
  }[]
}

/** Commandes créées depuis `since` (ISO), toutes pages confondues (200 max). */
export async function fetchOrders(since: Date): Promise<EbayOrder[]> {
  const out: EbayOrder[] = []
  let offset = 0
  const limit = 50
  while (offset < 200) {
    const filter = encodeURIComponent(`creationdate:[${since.toISOString().replace(/\.\d{3}Z$/, '.000Z')}..]`)
    const { data } = await ebayFetch(`/sell/fulfillment/v1/order?filter=${filter}&limit=${limit}&offset=${offset}`)
    const orders = (data.orders as EbayOrder[] | undefined) ?? []
    out.push(...orders)
    if (orders.length < limit) break
    offset += limit
  }
  return out
}

export function shipToText(o: EbayOrder): { name: string; address: string; contact: string } {
  const st = o.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo
  const a = st?.contactAddress
  const address = a
    ? [a.addressLine1, a.addressLine2, [a.postalCode, a.city].filter(Boolean).join(' '), a.stateOrProvince, a.countryCode].filter(Boolean).join(', ')
    : ''
  const contact = [st?.email, st?.primaryPhone?.phoneNumber, o.buyer?.username ? `eBay : ${o.buyer.username}` : ''].filter(Boolean).join(' · ')
  return { name: st?.fullName ?? o.buyer?.username ?? '', address, contact }
}

/** Code transporteur eBay à partir d'un libellé libre. */
export function carrierCode(label: string): string {
  const k = label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  const map: Record<string, string> = {
    COLISSIMO: 'COLISSIMO', LA_POSTE: 'LA_POSTE', CHRONOPOST: 'CHRONOPOST', MONDIAL_RELAY: 'MONDIAL_RELAY',
    UPS: 'UPS', DHL: 'DHL', DPD: 'DPD', GLS: 'GLS', FEDEX: 'FEDEX', TNT: 'TNT', RELAIS_COLIS: 'RELAIS_COLIS',
  }
  return map[k] ?? (k || 'OTHER')
}

/** Déclare l'expédition (n° de suivi) sur la commande eBay. */
export async function createShippingFulfillment(orderId: string, lineItemId: string, quantity: number, carrier: string, tracking: string): Promise<void> {
  await ebayFetch(`/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}/shipping_fulfillment`, {
    method: 'POST',
    body: JSON.stringify({
      lineItems: [{ lineItemId, quantity: Math.max(1, quantity) }],
      shippedDate: new Date().toISOString(),
      shippingCarrierCode: carrierCode(carrier),
      trackingNumber: tracking,
    }),
  })
}
