export function formatPrice(price: number): string {
  return price.toFixed(2) + ' €'
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR')
}

export function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR')
}

export function formatRelativeDay(ts: number): string {
  const now = new Date()
  const date = new Date(ts)
  if (now.toDateString() === date.toDateString()) return "Aujourd'hui"
  const yesterday = new Date(now.getTime() - 86400000)
  if (yesterday.toDateString() === date.toDateString()) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
