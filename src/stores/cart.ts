import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { CartItem, Piece } from '@/types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const discount = ref(0)

  const count = computed(() => items.value.length)
  const subtotal = computed(() => items.value.reduce((acc, i) => acc + i.qty * i.prixUnitaire, 0))
  const total = computed(() => subtotal.value * (1 - discount.value / 100))

  function add(piece: Piece, qty: number, prix: number) {
    const existing = items.value.find(i => i.piece._id === piece._id)
    if (existing) {
      existing.qty += qty
      existing.prixUnitaire = prix
    } else {
      items.value.push({ piece, qty, prixUnitaire: prix })
    }
  }

  function remove(index: number) {
    items.value.splice(index, 1)
  }

  function updateQty(index: number, qty: number) {
    if (items.value[index]) items.value[index].qty = qty
  }

  function setDiscount(val: number) {
    discount.value = Math.max(0, Math.min(100, val))
  }

  function clear() {
    items.value = []
    discount.value = 0
  }

  /**
   * Encaisse la vente : appelle la RPC transactionnelle `checkout_sale`
   * (crée la vente + lignes, décrémente le stock, trace les mouvements),
   * puis vide le panier. Renvoie l'id de la vente. Lève une erreur si le
   * stock est insuffisant (rien n'est écrit dans ce cas).
   */
  async function checkout(payment: string | null, client?: string): Promise<string> {
    if (!items.value.length) throw new Error('Panier vide')
    const payload = items.value.map((i) => ({
      piece_id: i.piece._id,
      qty: i.qty,
      prix: i.prixUnitaire,
    }))
    // RPC hors types générés → appel non typé.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('checkout_sale', {
      p_items: payload,
      p_payment: payment,
      p_discount: discount.value,
      p_client: client || null,
    })
    if (error) throw error
    clear()
    return data as string
  }

  return {
    items,
    discount,
    count,
    subtotal,
    total,
    add,
    remove,
    updateQty,
    setDiscount,
    clear,
    checkout
  }
})
