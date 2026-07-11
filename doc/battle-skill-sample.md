# 戦法個別実装サンプル

戦法を個別実装する時は、`src/lib/battleSimulator.ts` の `applyNamedSkill` に `case` を追加します。
ここで `true` を返すと、その戦法は汎用推定ロジックを通らず、ここに書いた処理だけで解決されます。

## 基本形

```ts
case 'サンプル戦法': { // 戦法名が「サンプル戦法」の時だけ、この個別処理を使う
  const target = ctx.target ?? chooseTarget(ctx.enemies, ctx.rng) // 既に対象があれば使い、無ければ敵から対象を選ぶ
  if (!target) return true // 対象がいない場合は、何もせず個別処理済みとして終了する

  dealSkillDamage(ctx, target, 120, 'physical') // 対象に120%の兵刃ダメージを与える

  if (roll(ctx.rng, 0.4)) { // 40%の確率判定を行う
    addControl(ctx, target, '無策', Math.round(varNumber(ctx.skill, 'duration', 1))) // 成功したら対象に無策を付与する
  }

  const ally = weakest(ctx.allies, 1)[0] // 自軍で最も兵力割合が低い武将を1人取得する
  if (ally) { // 回復対象が存在する場合だけ処理する
    healBySkill(ctx, ally, 80, 'strategy') // 対象を80%の知略依存回復で回復する
  }

  return true // 個別戦法として処理済みなので、汎用ロジックへ進ませない
}
```

## ターン開始で発動する戦法

`triggerForSkill` の戦法名リストにも追加します。

```ts
if (['疾風迅雷', '恵風和雨', '樽俎折衝', '風林火山', '伊達風采', 'サンプル戦法'].includes(skillName)) { // このリスト内の戦法か判定する
  return 'turnStart' // 該当する場合は、毎ターン開始時に発動判定する
}
```

## よく使う helper

- `dealSkillDamage(ctx, target, 120, 'physical')`
  - 兵刃ダメージ。倍率は `120%`。
- `dealSkillDamage(ctx, target, 120, 'strategy')`
  - 計略ダメージ。倍率は `120%`。
- `healBySkill(ctx, ally, 80, 'strategy')`
  - 回復。倍率は `80%`。
- `addControl(ctx, target, '無策', 1)`
  - 制御状態を1ターン付与。
- `weakest(ctx.allies, 2)`
  - 自軍の兵力割合が低い順に2人取得。
- `aliveRandom(ctx.enemies, ctx.rng).slice(0, 2)`
  - 生存している敵からランダムに2人取得。
- `varNumber(ctx.skill, 'duration', 1)`
  - `vars.duration` があれば使い、無ければ `1` を使う。
- `roll(ctx.rng, 0.4)`
  - 40%の確率判定。

## 武勇・知略依存で確率を上げる例

確率だけステータス依存にしたい場合は、基礎確率にステータス差分を足します。
下の例では、武勇または知略が `100` を超えた分だけ確率が少し上がります。

```ts
const statScaledChance = (baseChance: number, stat: number, maxChance: number) => { // 基礎確率、参照ステータス、上限確率を受け取る
  const bonus = Math.max(0, stat - 100) * 0.001 // ステータスが100を超えた分だけ、1につき0.1%加算する
  return clamp(baseChance + bonus, 0, maxChance) // 0%未満や上限超えにならないように丸めて返す
}
```

この helper は `applyNamedSkill` の近くに置いて使います。

### 武勇依存で戦法発動率を上げる

```ts
case '武勇依存発動サンプル': { // 戦法名が一致した時の個別処理
  const target = ctx.target ?? chooseTarget(ctx.enemies, ctx.rng) // 攻撃対象を取得する
  if (!target) return true // 対象がいなければ処理済みとして終了する

  const chance = statScaledChance(0.35, statOf(ctx.caster, 'val'), 0.7) // 基礎35%、武勇依存、最大70%の発動率を計算する
  if (!roll(ctx.rng, chance)) return true // 発動判定に失敗したら何もせず終了する

  dealSkillDamage(ctx, target, 110, 'physical') // 発動成功時、対象に110%の兵刃ダメージを与える
  return true // 個別処理済みとして終了する
}
```

### 知略依存で状態異常付与率を上げる

```ts
case '知略依存制御サンプル': { // 戦法名が一致した時の個別処理
  const target = ctx.target ?? chooseTarget(ctx.enemies, ctx.rng) // 制御を狙う対象を取得する
  if (!target) return true // 対象がいなければ終了する

  dealSkillDamage(ctx, target, 90, 'strategy') // まず対象に90%の計略ダメージを与える

  const controlChance = statScaledChance(0.3, statOf(ctx.caster, 'int'), 0.75) // 基礎30%、知略依存、最大75%の付与率を計算する
  if (roll(ctx.rng, controlChance)) { // 付与率で確率判定する
    addControl(ctx, target, '混乱', 1) // 成功したら混乱を1ターン付与する
  }

  return true // 個別処理済みとして終了する
}
```

### 武勇依存で麻痺付与率を上げる

```ts
case '武勇依存麻痺サンプル': { // 戦法名が一致した時の個別処理
  aliveRandom(ctx.enemies, ctx.rng) // 生存している敵をランダム順に並べる
    .slice(0, 2) // 先頭から2人を対象にする
    .forEach((enemy) => { // 対象ごとに処理する
      dealSkillDamage(ctx, enemy, 76, 'physical') // 対象に76%の兵刃ダメージを与える

      const paralyzeChance = statScaledChance(0.25, statOf(ctx.caster, 'val'), 0.5) // 基礎25%、武勇依存、最大50%の麻痺付与率を計算する
      if (roll(ctx.rng, paralyzeChance)) { // 麻痺付与判定を行う
        addControl(ctx, enemy, '麻痺', 1) // 成功したら麻痺を1ターン付与する
      }
    })

  return true // 個別処理済みとして終了する
}
```

## 複数対象ダメージの例

```ts
case '敵軍集団攻撃サンプル': { // 戦法名が一致した時の個別処理
  aliveRandom(ctx.enemies, ctx.rng) // 生存している敵をランダム順に並べる
    .slice(0, 2) // 2人を対象にする
    .forEach((enemy) => { // 対象ごとに処理する
      dealSkillDamage(ctx, enemy, 96, 'physical') // 各対象に96%の兵刃ダメージを与える
    })

  return true // 個別処理済みとして終了する
}
```

## 回復戦法の例

```ts
case '自軍回復サンプル': { // 戦法名が一致した時の個別処理
  weakest(ctx.allies, 2).forEach((ally) => { // 自軍の兵力割合が低い2人を対象にする
    healBySkill(ctx, ally, 122, 'strategy') // 各対象を122%の知略依存回復で回復する
  })

  return true // 個別処理済みとして終了する
}
```

## バフ戦法の例

```ts
case '自軍強化サンプル': { // 戦法名が一致した時の個別処理
  ctx.allies.forEach((ally) => { // 自軍全員に対して処理する
    ally.buffs.damageDealt = (ally.buffs.damageDealt ?? 0) + 12 // 与ダメージ補正を12%加算する
    ally.buffs.lea = (ally.buffs.lea ?? 0) + varNumber(ctx.skill, 'leadership_buff', 20) // 統率をvars値、無ければ20上げる
  })

  return true // 個別処理済みとして終了する
}
```

## 如水の例

`毎ターン行動前` は `triggerForSkill` で `beforeAction` にします。
`毎ターン初めて戦法回復を受けた時` は、回復処理の中から呼ぶ補助関数に分けると書きやすいです。

```ts
const statScaledChance = (baseChance: number, fighter: BattleFighter, stat: Stat, maxChance: number) => { // 基礎確率、参照武将、参照能力、上限確率を受け取る
  const bonus = Math.max(0, statOf(fighter, stat) - 100) * 0.001 // 能力が100を超えた分だけ、1につき0.1%を加算する
  return clamp(baseChance + bonus, 0, maxChance) // 0%未満や上限超えにならないように丸める
}

const gainJosuiKisaku = (fighter: BattleFighter, turn: number, logs: BattleLogEntry[], rng: () => number, reason: string) => { // 如水の奇策獲得だけを担当する
  const stacks = fighter.specialState.josuiKisakuStacks ?? 0 // 現在の奇策スタック数を取得する
  if (stacks >= 8) return // 最大8回までなので、8以上なら何もしない
  if (!roll(rng, statScaledChance(0.48, fighter, 'int', 0.9))) return // 48%、知略依存、上限90%で獲得判定する

  const nextStacks = Math.min(8, stacks + 1) // スタックを1増やし、8を超えないようにする
  fighter.specialState.josuiKisakuStacks = nextStacks // 新しいスタック数を保存する
  fighter.buffs.strategyDamageDealt = (fighter.buffs.strategyDamageDealt ?? 0) + 5 // 奇策1回分として計略与ダメージを5%上げる
  logs.push({ turn, side: fighter.side, actor: fighter.name, message: `如水: ${reason}で奇策を獲得(${nextStacks}/8)` }) // 戦闘ログに獲得内容を残す
}

const tryJosuiHealTrigger = (target: BattleFighter, turn: number, logs: BattleLogEntry[], rng: () => number) => { // 回復を受けた時の如水判定を担当する
  if (!target.skills.some((skill) => skillDisplayName(skill) === '如水')) return // 対象が如水を持っていなければ終了する
  if (target.specialState.josuiHealTurn === turn) return // このターンに既に回復時判定をしていれば終了する
  target.specialState.josuiHealTurn = turn // このターンの回復時判定を済みにする
  gainJosuiKisaku(target, turn, logs, rng, 'このターン初めて戦法回復を受けた時') // 回復時の奇策獲得判定を行う
}

case '如水': { // 黒田官兵衛の固有戦法
  gainJosuiKisaku(ctx.caster, ctx.turn, ctx.logs, ctx.rng, '行動前') // 行動前に48%、知略依存で奇策を獲得する

  const damageChance = ctx.caster.role === 'main' ? 0.75 : 0.6 // 大将なら75%、それ以外なら60%にする
  if (currentTarget && roll(ctx.rng, damageChance)) { // 対象がいて、計略ダメージ発動判定に成功した時だけ処理する
    const hits = 1 + Math.floor(ctx.rng() * 2) // 1〜2回の実行回数をランダムに決める
    for (let i = 0; i < hits; i += 1) { // 決まった回数だけ繰り返す
      dealSkillDamage(ctx, currentTarget, 88, 'strategy') // 敵軍単体に88%の知略依存計略ダメージを与える
    }
  }

  return true // 如水は個別実装で処理済みとして終了する
}
```

## 回復蓄積から計略ダメージを出す例

この例では戦法名を `回復蓄積サンプル` にしています。
実際に使う時は、`HEAL_STOCK_DAMAGE_SKILL_NAMES` と `case '回復蓄積サンプル'` を実戦法名に差し替えます。

```ts
const HEAL_STOCK_DAMAGE_SKILL_NAMES = ['回復蓄積サンプル'] // 回復蓄積型として扱う戦法名をまとめる

const hasAnySkillNamed = (fighter: BattleFighter, names: string[]) => // 武将が指定した名前の戦法をどれか持っているか調べる
  names.some((name) => hasSkillNamed(fighter, name)) // 1つでも一致すればtrueを返す

const addHealingStock = (allies: BattleFighter[], amount: number, turn: number, logs: BattleLogEntry[]) => { // 戦法回復量を蓄積する
  const stockAmount = Math.floor(amount * 0.75) // 回復量の75%だけ蓄積量に変換する
  if (stockAmount <= 0) return // 蓄積量が0以下なら何もしない

  allies // 回復した側の味方全体を見る
    .filter((ally) => hasAnySkillNamed(ally, HEAL_STOCK_DAMAGE_SKILL_NAMES)) // 回復蓄積型の戦法を持つ武将だけに絞る
    .forEach((owner) => { // 対象の武将ごとに処理する
      owner.specialState.healingStock = (owner.specialState.healingStock ?? 0) + stockAmount // 既存の蓄積量に加算する
      logs.push({ turn, side: owner.side, actor: owner.name, message: `回復蓄積: ${stockAmount}蓄積(合計${owner.specialState.healingStock})` }) // ログに蓄積量を残す
    })
}

case '回復蓄積サンプル': { // 回復蓄積型の個別戦法
  if (ctx.caster.role !== 'main') return true // 自軍大将の行動終了時だけ発動するので、大将以外なら終了する

  const stock = ctx.caster.specialState.healingStock ?? 0 // 現在の回復蓄積量を取得する
  if (stock <= 0) return true // 蓄積量が無ければ何もしない

  if (roll(ctx.rng, 0.8)) { // 80%の確率でダメージ処理を行う
    const targetCount = 1 + Math.floor(ctx.rng() * 2) // 敵軍複数1〜2名を決める
    const damageRate = 92 + Math.min(180, Math.floor(stock / 200)) // 基礎92%、蓄積200ごとに1%加算、上限+180%にする
    aliveRandom(ctx.enemies, ctx.rng) // 生存している敵をランダム順に並べる
      .slice(0, targetCount) // 決めた人数だけ対象にする
      .forEach((enemy) => dealSkillDamage(ctx, enemy, damageRate, 'strategy')) // 知略依存の計略ダメージを与える
  }

  ctx.logs.push({ turn: ctx.turn, side: ctx.caster.side, actor: ctx.caster.name, message: `回復蓄積をリセット(${stock})` }) // リセット前の蓄積量をログに残す
  ctx.caster.specialState.healingStock = 0 // 発動判定後、蓄積された回復量をリセットする
  return true // 個別処理済みとして終了する
}
```

回復蓄積は `healBySkill` と汎用回復処理の中で、実際に回復量が出た後に呼びます。

```ts
if (actual > 0) { // 実回復量がある時だけ処理する
  addHealingStock(ctx.allies, actual, ctx.turn, ctx.logs) // 回復した側の味方に、回復量の75%を蓄積する
  tryJosuiHealTrigger(target, ctx.turn, ctx.logs, ctx.rng) // 如水など、回復を受けた時の別効果も処理する
}
```

## 実装時の目安

1. 戦法名を `case '戦法名':` にする。
2. 発動タイミングが特殊なら `triggerForSkill` に追加する。
3. ダメージ、回復、制御、バフを helper で書く。
4. 確率がステータス依存なら `statScaledChance` で補正する。
5. 最後に必ず `return true` する。
6. まだ完全再現できない条件は、近似実装としてコメントを残す。
