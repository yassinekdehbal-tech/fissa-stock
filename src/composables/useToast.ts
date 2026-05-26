import { ref } from 'vue'

const toastMessage = ref('')
const toastVisible = ref(false)
const toastError = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

export function useToast() {
  function toast(msg: string, isError = false) {
    toastMessage.value = msg
    toastError.value = isError
    toastVisible.value = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastVisible.value = false }, 3000)
  }

  return { toastMessage, toastVisible, toastError, toast }
}
