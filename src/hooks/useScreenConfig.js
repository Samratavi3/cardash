import { useCarState } from './useCarState'
import { SCREEN_CONFIGS } from '../constants/screenSizes'

export function useScreenConfig() {
  const screenMode = useCarState(s => s.screenMode)
  return SCREEN_CONFIGS[screenMode] || SCREEN_CONFIGS['12.3']
}
