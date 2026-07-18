import { ref } from 'vue'

// === Battle Engine Types (Flat & Atomic Design) ===

export type SkillType = 'Assault' | 'Command' | 'Active' | 'Passive' | string;

export type TriggerEvent =
  | 'battleStart'
  | 'preparationTurn'
  | 'turnStart'
  | 'beforeAction'
  | 'beforeNormalAttack'
  | 'afterAction'
  | 'afterAttack'
  | 'afterNormalAttack'
  | 'onNormalAttackReceived'
  | 'onDamaged'
  | 'onPhysicalDamageReceived'
  | 'onStrategyDamageReceived'
  | 'onHeal'
  | 'onHealed'
  | 'beforeUniqueSkill'
  | 'always'
  | string;

// Formula: "150 + caster.val * 1.5"
export type Formula = number | string;

// Stats include leadership, valor, intelligence, politics, charm, and speed.
export type Stat = 'lea' | 'val' | 'int' | 'pol' | 'cha' | 'spd' | 'damageDealt' | 'damageTaken' | 'strategyDamageDealt' | 'attackDamage';

export interface Scaling {
  stat: Stat;
  ratio: number;
}

// === Target Definition ===
export type TargetSide = 'ally' | 'enemy';
export type TargetScope = 'single' | 'group' | 'all';
export type TargetSelect = 'random' | 'lowestHp' | 'highestStat' | 'lowestStat';

export type TargetDef = 
  | 'self'
  | 'currentTarget'
  | { 
      side: TargetSide; 
      scope?: TargetScope; 
      count?: number | [number, number]; 
      select?: TargetSelect;
      stat?: Stat; 
      filter?: Condition; 
    };

// === Condition Definition ===
export type Condition =
  | { type: 'hasStatus'; status: string; invert?: boolean }
  | { type: 'turn'; value: number | number[] }
  | { type: 'turnRange'; min?: number; max?: number }
  | { type: 'chance'; value: number; scale?: Scaling }
  | { type: 'stat'; stat: Stat; op: '>' | '<' | '>='; value: number | 'highest' | 'lowest' }
  | { type: 'stackCount'; key: string; op: '>' | '<' | '>='; value: number }
  | { type: 'isCommander'; invert?: boolean }
  | { type: 'isGeneralRole'; role: 'main' | 'vice' };

// === Effect Definition ===
export type Effect =
  | { type: 'damage'; damageType: 'physical' | 'strategy' | 'true'; value: Formula }
  | { type: 'heal'; value: Formula }
  | { type: 'applyStatus'; status: string; duration: number; chance?: number }
  | { type: 'removeStatus'; status: string }
  | { type: 'buff'; stat: Stat; value: Formula; duration: number }
  | { type: 'addStack'; key: string; value?: number; max?: number }
  | { type: 'clearStack'; key: string }
  | { type: 'consumeStack'; key: string; thenDo?: Action[] }
  | { type: 'sequence'; actions: Action[] };

export interface Action {
  when?: Condition[];
  to: TargetDef;
  do: Effect;
  else?: Action[];
}

export interface SkillVar {
  base: number;
  max: number;
  scale?: string;
}

export interface Skill {
  id: string;
  name: string;
  // null for override-added skills not yet on game8.jp — distinguishes "no JP
  // key" from "JP key not loaded yet" so the CHT⇄JP fallback can fire correctly
  name_jp?: string | null;
  // Historical names this skill replaced (e.g. fixed typos). Profile/inventory
  // lookups treat these as alternate keys so saved references still resolve.
  aliases?: string[];
  type: string;
  tags: string[];
  rarity: string;
  icon: string;
  description: string;
  description_jp?: string;
  commander_description?: string;
  commander_description_jp?: string;
  activation_rate?: string;
  probability?: number;
  category?: 'active' | 'passive' | 'command' | 'assault' | 'troop' | string;
  category_jp?: string;
  game8_kind?: string;
  game8_source_url?: string;
  battle_type?: 'bravery' | 'strategy' | string;
  damage_type?: string;
  damage_rate_max?: number;
  heal_rate_max?: number;
  dot_name?: string;
  dot_rate_max?: number;
  dot_turns?: number;
  control_type?: string;
  control_turns?: number;
  buff_types?: string;
  debuff_types?: string;
  battle_tags?: string[];
  effect_value?: string;
  target_jp?: string;
  target?: string;
  vars?: Record<string, SkillVar | number>;
  source_hero?: string;
  unique_hero?: string;
  is_unique?: boolean;
  is_teachable?: boolean;
  is_fixed?: boolean;
  is_event_skill?: boolean;
  brief_description?: string;
  brief_description_jp?: string;
  related_stats?: string[];
  rate?: [number, number];
  cooldown?: number;
  maxPerTurn?: number;
  trigger?: TriggerEvent;
  triggers?: TriggerEvent[];
  do?: Action[];
  bonus?: {
    commander?: Action[];
    characters?: Record<string, Action[]>;
  };
  sim_id?: string;
}

export interface TroopAffinity {
  troop_types: string[]
  level: number
  level_cap_bonus: number
}

export interface Trait {
  name: string
  name_jp?: string | null
  rank: 'S' | 'A' | 'B' | 'C'
  active: boolean
  description?: string
  description_jp?: string
  vars?: Record<string, any>
  affinity?: TroopAffinity | null
}

export type BingxueDirection = '武略' | '陣立' | '機略' | '臨戦'
export const BINGXUE_DIRECTIONS: BingxueDirection[] = ['武略', '陣立', '機略', '臨戦']
export type BingxueTier = 'major' | 'minor'

export interface BingxueOption {
  name: string           // Display name
  name_jp: string        // JP key — used in references
  direction: BingxueDirection
  direction_jp: string
  tier: BingxueTier
  description: string    // Description with {var:}/{status:}/{scale:} template
  description_jp: string
  vars: Record<string, any>
}

// Per-hero available bingxue: direction -> {major, minor} JP name arrays.
// Each direction offers 3 majors + 6 minors for the hero to pick from.
export type HeroBingxue = Record<BingxueDirection, { major: string[]; minor: string[] }>

export interface Hero {
  name: string
  name_jp?: string | null
  aliases?: string[]
  faction: string
  clan?: string
  cost: number
  rarity: number | string
  gender?: string
  portrait: string
  detail_url?: string
  unique_skill?: string | null
  teachable_skill?: string | null
  assembly_skill?: string | null
  stats?: {
    lea: number
    val: number
    int: number
    pol: number
    cha: number
    spd: number
  }
  sim_id?: string
  faction_jp?: string
  clan_jp?: string
  traits?: Trait[]
  bingxue?: HeroBingxue | null
}

export interface EnemyFormationMember {
  commander_id: string
  skill1_id?: string
  skill2_id?: string
  troops?: number
  breakthrough?: string
  stat_focus?: string
}

export interface EnemyFormation {
  id: string
  name: string
  members: EnemyFormationMember[]
}

import heroesData from '../../.build/heroes.json'
import skillsData from '../../.build/skills.json'
import statusesData from '../../.build/statuses.json'
import bingxueData from '../../.build/bingxue.json'
import enemyFormationsData from '../../.build/enemy_formations.json'
import { withHeroLevel50Stats } from '../lib/heroStats'

const DEFAULT_ICONS: Record<string, string> = {
  '指揮': 'https://p11386-media-cdn.sialiagames.com.tw/meta_10000270/1765785439101/res/ui/icon/skill/icon_skill_zh_kongzhi.png?x-oss-process=image/format,webp/interlace,1/quality,Q_80/resize,w_164&t=1',
  '能動': 'https://p11386-media-cdn.sialiagames.com.tw/meta_10000270/1765785439101/res/ui/icon/skill/icon_skill_zd_bingren_single.png?x-oss-process=image/format,webp/interlace,1/quality,Q_80/resize,w_164&t=1',
  '突撃': 'https://p11386-media-cdn.sialiagames.com.tw/meta_10000270/1765785439101/res/ui/icon/skill/icon_skill_tj_bingren_single.png?x-oss-process=image/format,webp/interlace,1/quality,Q_80/resize,w_164&t=1',
  '受動': 'https://p11386-media-cdn.sialiagames.com.tw/meta_10000270/1765785439101/res/ui/icon/skill/icon_skill_bd_zengyi.png?x-oss-process=image/format,webp/interlace,1/quality,Q_80/resize,w_164&t=1',
  '兵種': 'https://p11386-media-cdn.sialiagames.com.tw/meta_10000270/1765785439101/res/ui/icon/skill/icon_skill_tsbz_chibeidui.png?x-oss-process=image/format,webp/interlace,1/quality,Q_80/resize,w_164&t=1',
};

const SKILL_JP_OVERRIDES: Record<string, Partial<Skill>> = {
  '出奇制勝': {
    name_jp: '出奇制勝',
    description_jp: '戦闘中、自身の固有能動戦法による与ダメージが{var:damage_buff}上昇する（{scale:知略}）。自身が固有能動戦法の発動に成功した後、{var:crit_chance}の確率で自身に{var:crit_effect}{status:攻心}を付与する（{scale:知略}、最大{var:crit_stack_max}回まで重ねがけ可能）。',
    brief_description_jp: '固有能動戦法の与ダメージを上げ、確率で攻心を獲得',
  },
  '越後先手組': {
    name_jp: '越後先手組',
    description_jp: '騎兵を先手必勝の越後先手組に進化させる。戦闘中、自軍全体の速度が{var:speed_buff}上昇する。第2ターン以降、自軍全体は毎ターン行動前、{var:activation_rate}の確率（武勇と速度依存）で自軍単体の兵力を回復する（回復率{var:recovery_rate}、{scale:武勇}）。上杉謙信が統率している場合、自軍で武勇が最も高い武将が通常攻撃で目標を撃破した時、追加で兵力回復効果を発動する。',
    brief_description_jp: '騎兵を進化させ、速度上昇と確率回復を付与',
  },
  '追亡逐北': {
    name_jp: '追亡逐北',
    description_jp: '敵軍単体に{var:dmg_rate}の計略ダメージを与え（{scale:知略}）、{status:畏縮}状態を1ターン付与する。',
    brief_description_jp: '単体計略ダメージと畏縮付与',
  },
  '伊達風采': {
    name_jp: '伊達の粋',
    description_jp: '戦闘開始時、自身が5層の風采を獲得する。毎ターン行動時、風采を1層消費して敵軍単体にそれぞれ{var:dmg_rate}の兵刃ダメージと計略ダメージを与える（{scale:武勇}/{scale:知略}）。兵刃ダメージと計略ダメージをそれぞれ2回与えるたび、自身の武勇と知略が{var:stat_buff}上昇する（{scale:武勇}/{scale:知略}）。最大{var:buff_stack_max}回まで重ねがけ可能で、最大到達後は風采を1層獲得する。',
    brief_description_jp: '風采を消費して兵刃・計略ダメージを与え、重ねがけで能力上昇',
  },
  '龍騎兵': {
    name_jp: '竜騎兵',
    description_jp: '適応兵種: 鉄砲。鉄砲を竜騎兵に進化させ、部隊の移動速度を{var:move_speed_buff}上昇させる。毎ターン開始時、弾丸がなければ1発装填し、{var:double_ammo_chance}の確率で2発装填する（{scale:武勇}/{scale:速度}）。弾丸を持つ場合、{var:ammo_consume_chance}の確率（{scale:速度}）で1発消費し、敵軍単体に{var:dmg_rate}のダメージを与える（武勇または知略の高い方で判定）。伊達政宗が統率している場合、行動後に{var:commander_fill_chance}の確率（{scale:武勇}/{scale:知略}）で弾丸を1発装填する。',
    brief_description_jp: '鉄砲を進化させ、弾丸を消費してダメージを与える',
  },
  '神出鬼沒': {
    name_jp: '神出鬼没',
    description_jp: '自身が通常攻撃の対象に選ばれる確率を大きく下げる。自身の次の通常攻撃後、目標に{var:damage_rate}の兵刃ダメージを与える。{var:duration}ターン持続。',
    brief_description_jp: '狙われにくくなり、次の通常攻撃を強化',
  },
  '伊賀忍者': {
    name_jp: '伊賀忍者',
    description_jp: '適応兵種: 弓兵。弓兵を諜報に長けた伊賀忍者に進化させる。自軍全体の武勇と速度が{var:ally_valor_speed_buff}上昇する。戦闘開始時、敵軍1名につき{var:intel_stacks_per_enemy}個の密報を獲得する。敵軍へ通常攻撃した後、{var:trigger_chance}の確率で密報を1個消費し、追加で{var:damage_rate}の兵刃ダメージを与える。同一武将の密報を消費しきると、その武将に{status:疲弊}を{var:exhausted_duration}ターン付与する。藤林正保が統率している場合、確率が追加で{var:leader_scale}の影響を受ける。',
    brief_description_jp: '弓兵を進化させ、密報を使って追加ダメージを与える',
  },
  '風流武者': {
    name_jp: '風流武者',
    description_jp: '自身が1回目に能動または突撃戦法を発動した時、{var:trigger_chance}の確率（{scale:知略}）で自軍複数（2名）の兵力を回復する（回復率{var:heal_rate}、{scale:知略}）。2回目に能動または突撃戦法を発動した時、{var:trigger_chance}の確率（{scale:知略}）で自軍複数（2名）の計略与ダメージを{var:damage_buff}上昇させる（{scale:知略}）。{var:buff_duration}ターン持続、最大{var:max_stacks}回まで重ねがけ可能。奇数ターンごとに発動回数をリセットする。',
    brief_description_jp: '能動・突撃戦法の発動に応じて回復または計略与ダメージ上昇',
  },
  '威風凜凜': {
    name_jp: '威風凛凛',
    description_jp: '通常攻撃後、目標に{var:damage_rate}の兵刃ダメージを与え、目標の次の{var:debuff_duration}回の与ダメージを{var:damage_debuff}低下させる（{scale:武勇}）。各目標には最大{var:max_debuff_stacks}回分まで与ダメージ低下効果が存在し、各効果は{var:debuff_duration}ターン持続する。',
    brief_description_jp: '通常攻撃後に兵刃ダメージを与え、目標の与ダメージを低下',
  },
  '傳馬疾馳': {
    name_jp: '伝馬疾馳',
    description_jp: '友軍単体の武勇と速度を{var:valor_speed_buff}上昇させ（{scale:知略}）、その友軍が行動前に敵軍単体へ{var:damage_rate}の兵刃ダメージを与えるようにする（自身と目標の速度差の影響を受ける、{scale:知略}）。{var:buff_duration}ターン持続。持続終了時、効果を別の友軍単体へ移す（再移動不可）。',
    brief_description_jp: '友軍を強化し、効果終了時に別の友軍へ移す',
  },
  '上州黃斑': {
    name_jp: '上州の黄斑',
    description_jp: '戦闘中、前ターンに通常攻撃を受けていた場合、{var:trigger_rate}の確率（{scale:統率}）で攻撃してきた目標に{status:消沈}を付与する（ダメージ率{var:debuff_rate}、{scale:知略}）。{var:debuff_duration}ターン持続。そうでない場合、{var:random_rate}の確率（{scale:統率}）で敵軍複数（2名）に{status:消沈}を付与する。消沈を付与する時、対象がすでに消沈状態なら、代わりに{var:fatigue_rate}{status:疲弊}を付与する（{scale:統率}）。{var:fatigue_duration}ターン持続。',
    brief_description_jp: '条件に応じて消沈または疲弊を付与',
  },
  '戮力同心': {
    name_jp: '戮力同心',
    description_jp: '戦闘中、毎ターン{var:heal_trigger_rate}の確率（{scale:統率}）で自身と友軍単体の兵力を回復する（回復率{var:heal_rate}、{scale:統率}）。自身が自軍で兵力最低でない場合、回復対象が友軍複数になる。',
    brief_description_jp: '毎ターン確率で自身と友軍を回復',
  },
  '鬼義重': {
    name_jp: '鬼義重',
    description_jp: '敵軍複数（2名）に{var:dmg_rate}の兵刃ダメージを与え、統率を{var:stat_debuff}低下させる（{scale:武勇}）。{var:debuff_duration}ターン持続。',
    brief_description_jp: '複数兵刃ダメージと統率低下',
  },
  '股肱之臣': {
    name_jp: '股肱の臣',
    description_jp: '自軍複数（2-3名）に{var:revive_count}回の回生を付与する（回復率{var:heal_rate}、{scale:知略}）。{var:duration}ターン持続。持続終了時、残りの回生1回につき対象の与ダメージを{var:dmg_boost}上昇させる（{scale:知略}）。{var:duration}ターン持続。',
    brief_description_jp: '複数に回生を付与し、残数に応じて与ダメージ上昇',
  },
  '荷馱崩': {
    name_jp: '荷駄崩',
    description_jp: '敵軍複数（2名）に{var:dmg_rate}の計略ダメージを与え（{scale:知略}）、受ける回復効果を{var:heal_reduction}低下させる。{var:duration}ターン持続。',
    brief_description_jp: '複数計略ダメージと被回復効果低下',
  },
  '天神山殘照': {
    name_jp: '天神山残照',
    description_jp: '通常攻撃後、{var:normal_atk_chance}の確率で目標に{var:normal_atk_dmg}の計略ダメージを与える（{scale:知略}）。戦闘開始から4ターンの間、毎ターン行動前に自身の武勇と知略を{var:stat_buff}上昇させる（{scale:知略}）。{var:duration}ターン持続し、毎ターン上昇量は{var:stat_reduction}ずつ減少する。第5ターン開始時、知略が最も高い友軍単体に{status:混乱}を1ターン付与する。',
    brief_description_jp: '通常攻撃後に計略ダメージを与え、序盤は自身の能力を上昇',
  },
  '臨時槍之鈴': {
    name_jp: '臨時槍の鈴',
    description_jp: '通常攻撃後、敵軍単体に兵刃ダメージ（ダメージ率{1%}）を与える。第3ターン以降、追加で自身の兵力を回復する（回復率{2%}、武勇依存）。',
    brief_description_jp: '兵刃ダメージを与え、条件付きで自身を回復',
  },
  '速戰': {
    name_jp: '速戦',
    description_jp: '自身の速度を{1}上昇させる。',
    brief_description_jp: '速度上昇',
  },
}

const normalizeSkillType = (type: string): string => {
  if (type === '被動' || type === '被动') return '受動'
  if (type === '主動' || type === '主动') return '能動'
  if (type === '突擊' || type === '突击') return '突撃'
  if (type === '兵种') return '兵種'
  if (type === '指挥') return '指揮'
  if (type === '阵法') return '陣法'
  return type
}

const normalizeBingxueDirection = (direction: string | null | undefined): BingxueDirection | null => {
  if (direction === '臨戰') return '臨戦'
  return BINGXUE_DIRECTIONS.includes(direction as BingxueDirection) ? direction as BingxueDirection : null
}

const normalizeHeroBingxue = (bingxue: HeroBingxue | null | undefined): HeroBingxue | null => {
  if (!bingxue) return null
  return BINGXUE_DIRECTIONS.reduce((out, direction) => {
    const legacyDirection = direction === '臨戦' ? '臨戰' : direction
    out[direction] = {
      major: [...(bingxue[direction]?.major ?? bingxue[legacyDirection as BingxueDirection]?.major ?? [])],
      minor: [...(bingxue[direction]?.minor ?? bingxue[legacyDirection as BingxueDirection]?.minor ?? [])],
    }
    return out
  }, {} as HeroBingxue)
}

const normalizeHero = (hero: Hero): Hero => withHeroLevel50Stats({
  ...hero,
  bingxue: normalizeHeroBingxue(hero.bingxue),
})

const normalizeBingxueOption = (option: BingxueOption): BingxueOption => ({
  ...option,
  direction: normalizeBingxueDirection(option.direction) ?? '武略',
  direction_jp: option.direction_jp === '臨戰' ? '臨戦' : option.direction_jp,
})

const normalizeSkill = (skill: Skill): Skill => {
  const override = SKILL_JP_OVERRIDES[skill.name] ?? {}
  const type = normalizeSkillType(skill.type)
  return {
    ...skill,
    ...override,
    type,
    icon: skill.icon || DEFAULT_ICONS[skill.type] || DEFAULT_ICONS[type] || '',
  }
}

const heroes = ref<Hero[]>(heroesData && Array.isArray(heroesData) ? (heroesData as unknown as Hero[]).map(normalizeHero) : [])
const skills = ref<Skill[]>(skillsData && Array.isArray(skillsData) ? (skillsData as unknown as Skill[]).map(normalizeSkill) : [])
const statuses = ref<Record<string, any>>(statusesData || {})
const bingxue = ref<Record<string, BingxueOption>>(
  Object.fromEntries(
    Object.entries((bingxueData as Record<string, BingxueOption>) || {})
      .map(([key, option]) => [key, normalizeBingxueOption(option)])
  )
)
const enemyFormations = ref<EnemyFormation[]>(
  Array.isArray(enemyFormationsData) ? (enemyFormationsData as EnemyFormation[]) : []
)

export function useData() {
  return { heroes, skills, statuses, bingxue, enemyFormations }
}
