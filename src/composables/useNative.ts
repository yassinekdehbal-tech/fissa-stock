import { Capacitor } from '@capacitor/core'

export function useNative() {
  const isNative = Capacitor.isNativePlatform()
  const platform = Capacitor.getPlatform()

  async function initNative() {
    if (!isNative) return

    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setBackgroundColor({ color: '#0d1117' })
    } catch {}

    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide()
    } catch {}

    try {
      const { App } = await import('@capacitor/app')
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        }
      })
    } catch {}
  }

  async function hapticFeedback() {
    if (!isNative) return
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch {}
  }

  async function hapticSuccess() {
    if (!isNative) return
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics')
      await Haptics.notification({ type: NotificationType.Success })
    } catch {}
  }

  return { isNative, platform, initNative, hapticFeedback, hapticSuccess }
}
