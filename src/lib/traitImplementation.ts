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

const MANUAL_TROOP_LEVEL_TRAIT_DETAILS: Readonly<Record<string, string>> = {
  弓術I: '弓兵兵種レベル+1',
  槍術I: '足軽兵種レベル+1',
  馬術I: '騎兵兵種レベル+1',
  砲術I: '鉄砲兵種レベル+1',
}

export const traitImplementation = (trait: Trait): TraitImplementation => {
  const name = trait.name_jp || trait.name
  const normalizedName = name.normalize('NFKC')
  const manualTroopLevelDetail = MANUAL_TROOP_LEVEL_TRAIT_DETAILS[normalizedName]
  if (manualTroopLevelDetail) return { status: 'implemented', detail: manualTroopLevelDetail }
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
