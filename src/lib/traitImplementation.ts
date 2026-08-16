import type { Trait } from '../composables/useData'
import {
  IMPLEMENTED_NAMED_TRAIT_EFFECTS,
  NON_BATTLE_TRAIT_NAMES,
  traitBattleEffectDetail,
} from './battleTraitEffects'

export type TraitImplementationStatus = 'implemented' | 'partial' | 'unimplemented'

export interface TraitImplementation {
  status: Exclude<TraitImplementationStatus, 'partial'>
  detail: string
}

// 個別の特性効果を戦闘ロジックへ追加した場合は、ここへ特性名と実装内容を登録する。
// 兵種レベル・上限効果は affinity の構造化データを使う共通処理で実装済み。
export const IMPLEMENTED_TRAIT_EFFECTS: Readonly<Record<string, string>> = IMPLEMENTED_NAMED_TRAIT_EFFECTS

export const traitImplementation = (trait: Trait): TraitImplementation => {
  const name = trait.name_jp || trait.name
  if (name.normalize('NFKC') === '砲術I') {
    return { status: 'implemented', detail: '鉄砲兵種レベル+1' }
  }
  if (NON_BATTLE_TRAIT_NAMES.has(name)) {
    return { status: 'unimplemented', detail: '内政・成長用特性（戦闘実装対象外）' }
  }
  const namedDetail = IMPLEMENTED_TRAIT_EFFECTS[name]
  if (namedDetail) return { status: 'implemented', detail: namedDetail }

  const staticBattleDetail = traitBattleEffectDetail(trait)
  if (staticBattleDetail) return { status: 'implemented', detail: staticBattleDetail }

  if (trait.affinity) {
    const effects: string[] = []
    if (Number(trait.affinity.level) > 0) effects.push('兵種レベル反映')
    if (Number(trait.affinity.level_cap_bonus) > 0) effects.push('兵種上限反映')
    if (effects.length > 0) return { status: 'implemented', detail: effects.join('・') }
  }

  return { status: 'unimplemented', detail: '戦闘ロジック未実装' }
}
