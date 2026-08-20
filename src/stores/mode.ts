import { defineStore } from 'pinia'
import { ref } from 'vue'

export type WorkspaceMode = 'piece' | 'mecanique'

const STORAGE_KEY = 'fissa-mode'

/**
 * Espace de travail courant, choisi dans l'en-tête et memorise par appareil :
 * - PIÈCE : magasin (référencement, stock, scan, vente, multidiffusion)
 * - MÉCANIQUE : atelier (chantiers)
 * Les pages de gestion (reporting, caisse, historique, utilisateurs)
 * restent visibles dans les deux modes.
 */
export const useModeStore = defineStore('mode', () => {
  const stored = localStorage.getItem(STORAGE_KEY)
  const mode = ref<WorkspaceMode>(stored === 'mecanique' ? 'mecanique' : 'piece')

  function setMode(m: WorkspaceMode) {
    mode.value = m
    localStorage.setItem(STORAGE_KEY, m)
  }

  return { mode, setMode }
})
