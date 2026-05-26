import { ref } from 'vue'
import { useNative } from './useNative'

const toastMessage = ref('')
const toastVisible = ref(false)
const toastError = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

export function useToast() {
  const { hapticSuccess, hapticFeedback } = useNative()

  function toast(msg: string, isError = false) {
    toastMessage.value = msg
    toastError.value = isError
    toastVisible.value = true
    if (isError) hapticFeedback()
    else hapticSuccess()
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastVisible.value = false }, 3000)
  }

  return { toastMessage, toastVisible, toastError, toast }
}
