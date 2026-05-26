import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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
    clear
  }
})
