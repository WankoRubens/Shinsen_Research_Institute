import { ref, watch } from 'vue'
import { useDialogs } from './useDialogs'
import { LATEST_VERSION } from '../constants/changelog'

const SEEN_KEY = 'nobunaga.changelog.lastSeen'

const hasUnseen = ref(localStorage.getItem(SEEN_KEY) !== LATEST_VERSION)

const markSeen = () => {
  localStorage.setItem(SEEN_KEY, LATEST_VERSION)
  hasUnseen.value = false
}

// Auto-mark seen whenever the changelog overlay closes — covers any close path
// (X button, ESC, opening another overlay). Set up at module load so the watch
// outlives any single call site.
const { useDialog } = useDialogs()
const changelogDialogVisible = useDialog('changelog')
watch(changelogDialogVisible, (now, prev) => {
  if (prev && !now) markSeen()
})

export function useChangelog() {
  return { hasUnseen, markSeen, changelogDialogVisible }
}
