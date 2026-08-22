# 戦法個別実装サンプル

戦法を個別実装する時は、基本的に `src/lib/battleSkillEffects.ts` の次の2か所を更新します。

1. `BATTLE_SKILL_EFFECT_META` に戦法タイプと発動タイミングを登録する。
2. `applyNamedSkillEffect` の `switch` に `case '戦法名'` を追加する。

この2か所へ同じ戦法名を登録すると、戦法一覧でも「個別戦法ロジック・実装済み」と判定されます。

Sランク武将の固有戦法は、同じ仕組みを使う `src/lib/battleUniqueSkillEffects.ts` にまとめています。
`battleSimulator.ts` には戦闘全体の共通処理だけを置き、個別戦法の `case` は追加しません。

## 1. 戦法タイプと発動タイミングを登録する

```ts
export const BATTLE_SKILL_EFFECT_META: Record<string, BattleSkillEffectMeta> = {
  サンプル戦法: defineBattleSkillMeta({ // 個別実装する戦法名を登録する
    type: '能動', // 戦法タイプを指定する
    triggers: ['beforeAction'], // 所持武将の行動開始前に発動判定する
    replaceStructuredTriggers: true, // skills.json側の発動タイミングを使わず、この指定だけを使う
  }),
}
```

戦法タイプの優先順位は次のとおりです。同じタイミングでは、同タイプ内を武将の第1・第2・第3戦法の装備順で処理します。

```text
受動 -> 兵種 -> 指揮 -> 陣法 -> 能動 -> 突撃
```

### 使用できる主な発動タイミング

| 指定値 | 発動タイミング |
| --- | --- |
| `preparationTurn` | 準備ターン |
| `turnStart` | 各ターン開始時 |
| `beforeAction` | 所持武将の行動開始前 |
| `beforeNormalAttack` | 通常攻撃前 |
| `afterNormalAttack` | 通常攻撃後 |
| `onNormalAttackReceived` | 通常攻撃を受けた時 |
| `onHealed` | 戦法による回復を受けた時 |
| `onPhysicalDamageReceived` | 兵刃ダメージを受けた時 |
| `onStrategyDamageReceived` | 計略ダメージを受けた時 |
| `beforeUniqueSkill` | 固有戦法を発動する前 |
| `afterAction` | 所持武将の行動終了後 |
| `turnEnd` | 各ターン終了時 |

### 1つの戦法に複数のタイミングがある場合

```ts
複数タイミング戦法: defineBattleSkillMeta({ // 1つの戦法に複数の効果がある
  type: '指揮', // 指揮戦法として処理する
  triggers: ['preparationTurn', 'beforeAction', 'onHealed'], // 必要なイベントをすべて購読する
  replaceStructuredTriggers: true, // この個別指定だけを使用する
  followUpTriggers: ['beforeAction', 'onHealed'], // 準備ターン後の効果では戦法発動率を再抽選しない
}),
```

- `replaceStructuredTriggers: true` は、個別実装のタイミングだけを使いたい場合に指定します。
- `followUpTriggers` に入れたイベントは、最初に成立した指揮・受動効果の後続処理として扱い、発動率を再抽選しません。
- `maxPerTurn: 1` を追加すると、その戦法を1ターン1回までに制限できます。

## 2. 基本の個別caseを書く

```ts
case 'サンプル戦法': { // 戦法名が一致した時だけ、この個別処理を使う
  // 指定済みの対象が生存していれば、その対象を使う。
  const target = ctx.target && ctx.target.hp > 0
    ? ctx.target
    : h.chooseTarget(ctx.enemies, ctx.rng, ctx) // 指定対象がいなければ、生存している敵から選ぶ

  if (!target) return true // 攻撃可能な敵がいなければ、個別処理済みとして終了する

  h.dealSkillDamage(ctx, target, 120, 'physical') // 対象へ120%の兵刃ダメージを与える

  if (h.roll(ctx.rng, 0.4)) { // 40%の追加効果判定を行う
    h.addControl(ctx, target, '無策', 1) // 成功時、対象へ無策を1ターン付与する
  }

  return true // 個別戦法として処理済みなので、共通処理へ進ませない
}
```

能動・突撃戦法の基本発動率は戦闘エンジン側で判定されます。`case` 内で同じ発動率をもう一度抽選しないでください。
`h.roll` は「40%で制御状態を付与」など、戦法が発動した後の追加判定に使います。

## 3. よく使うhelper

- `h.dealSkillDamage(ctx, target, 120, 'physical')`
  - 120%の兵刃ダメージを与えます。
- `h.dealSkillDamage(ctx, target, 120, 'strategy')`
  - 120%の計略ダメージを与えます。
- `h.healBySkill(ctx, target, 80, 'strategy')`
  - 80%・知略依存の回復を行います。
- `h.healBySkill(ctx, target, 80, 'bravery')`
  - 80%・武勇依存の回復を行います。
- `h.healBySkill(ctx, target, 80, 'leadership')`
  - 80%・統率依存の回復を行います。
- `h.healFixedBySkill(ctx, target, 500)`
  - ダメージの一定割合など、再計算しない固定量を回復します。
- `h.addControl(ctx, target, '無策', 1)`
  - 制御状態を1ターン付与します。同じ制御状態は重ね掛け・上書きされません。
- `h.addTimedModifier(ctx, target, 'damageDealt', 12, 2, 1)`
  - 与ダメージを12%上げる効果を2ターン、最大1層で付与します。
- `h.weakest(ctx.allies, 2)`
  - 自軍を兵力割合が低い順に2人取得します。
- `h.aliveRandom(ctx.allies, ctx.rng, ctx).slice(0, 2)`
  - 生存中の自軍からランダムに2人取得します。
- `h.statOf(ctx.caster, 'int')`
  - バフ・デバフを含む現在の知略を取得します。
- `h.varNumber(ctx.skill, 'duration', 1)`
  - `vars.duration` があればその値を、なければ `1` を取得します。

## 4. 対象の選び方

### ランダムな敵軍2人へダメージ

```ts
case '敵軍複数攻撃サンプル': { // 敵軍複数を攻撃する戦法
  h.aliveRandom(ctx.enemies, ctx.rng, ctx) // 生存中の敵をランダム順に並べる
    .slice(0, 2) // 先頭から2人を対象にする
    .forEach((enemy) => { // 選ばれた敵を1人ずつ処理する
      h.dealSkillDamage(ctx, enemy, 96, 'physical') // 各対象へ96%の兵刃ダメージを与える
    })

  return true // 個別処理済みとして終了する
}
```

### ランダムな自軍2人を回復

```ts
case '自軍ランダム回復サンプル': { // 自軍複数を回復する戦法
  h.aliveRandom(ctx.allies, ctx.rng, ctx) // 生存中の自軍をランダム順に並べる
    .slice(0, 2) // 先頭から2人を対象にする
    .forEach((ally) => { // 選ばれた味方を1人ずつ処理する
      h.healBySkill(ctx, ally, 122, 'strategy') // 各対象を122%・知略依存で回復する
    })

  return true // 個別処理済みとして終了する
}
```

### 最も兵力割合が低い自軍1人を回復

```ts
case '自軍最低兵力回復サンプル': { // 最も消耗している味方を回復する戦法
  const ally = h.weakest(ctx.allies, 1)[0] // 兵力割合が最も低い味方を取得する
  if (!ally) return true // 生存中の味方がいなければ終了する

  h.healBySkill(ctx, ally, 180, 'strategy') // 対象を180%・知略依存で回復する
  return true // 個別処理済みとして終了する
}
```

「ランダム」と「兵力が最も低い」は別の仕様です。説明文がランダムの場合は `h.weakest` を使わないでください。

## 5. 能力依存の確率と効果量

現在の共通計算に合わせる場合は、次の補助関数を `battleSkillEffects.ts` 内で使用します。

```ts
const attributeDependentChance = (baseChance: number, stats: number[]): number => { // 基礎確率と参照能力を受け取る
  const average = stats.reduce((sum, value) => sum + value, 0) / Math.max(1, stats.length) // 複数能力なら平均値を求める
  return Math.min(0.95, baseChance + Math.max(0, average - 100) * 0.001) // 能力100超過分を加算し、95%を上限にする
}

const attributeDependentValue = (baseValue: number, stats: number[]): number => { // 基礎効果量と参照能力を受け取る
  const average = stats.reduce((sum, value) => sum + value, 0) / Math.max(1, stats.length) // 複数能力なら平均値を求める
  return baseValue * (1 + Math.max(0, average - 100) * 0.001) // 能力100超過分を相対倍率として掛ける
}
```

### 知略依存で制御状態付与率を上げる

```ts
case '知略依存制御サンプル': { // 知略依存の追加効果を持つ戦法
  const target = h.chooseTarget(ctx.enemies, ctx.rng, ctx) // 生存中の敵から対象を選ぶ
  if (!target) return true // 対象がいなければ終了する

  h.dealSkillDamage(ctx, target, 90, 'strategy') // 対象へ90%の計略ダメージを与える

  const chance = attributeDependentChance(0.3, [h.statOf(ctx.caster, 'int')]) // 基礎30%・知略依存の付与率を求める
  if (h.roll(ctx.rng, chance)) { // 求めた確率で付与判定を行う
    h.addControl(ctx, target, '混乱', 1) // 成功時、混乱を1ターン付与する
  }

  return true // 個別処理済みとして終了する
}
```

## 6. 一時的な能力・与被ダメージ補正

```ts
case '一時強化サンプル': { // 一時的な強化を付与する戦法
  const valor = h.statOf(ctx.caster, 'val') // 現在の武勇を取得する
  const bonus = attributeDependentValue(12, [valor]) // 基礎12%・武勇依存の効果量を計算する

  h.addTimedModifier(ctx, ctx.caster, 'damageDealt', bonus, 2, 1) // 自身の与ダメージを2ターン、最大1層で上げる
  h.addTimedModifier(ctx, ctx.caster, 'damageTaken', -10, 2, 1) // 自身の被ダメージを2ターン、最大1層で下げる

  return true // 個別処理済みとして終了する
}
```

`damageDealt` と `damageTaken` は割合をそのまま指定します。被ダメージを下げる場合は負の値を使います。

## 7. 効果ごとに発動タイミングが異なる戦法

```ts
複数効果サンプル: defineBattleSkillMeta({ // メタ情報へ複数の発動タイミングを登録する
  type: '指揮', // 指揮戦法として処理する
  triggers: ['preparationTurn', 'beforeAction', 'onHealed'], // 準備、行動前、回復を受けた時に呼び出す
  replaceStructuredTriggers: true, // 登録したタイミングだけを使用する
  followUpTriggers: ['beforeAction', 'onHealed'], // 後続効果では発動率を再抽選しない
}),
```

```ts
case '複数効果サンプル': { // 複数のイベントで呼ばれる個別戦法
  if (ctx.trigger === 'preparationTurn') { // 準備ターンの処理か確認する
    ctx.caster.specialState.samplePrepared = 1 // 後続効果が有効であることを保存する
    return true // このイベントの処理を終了する
  }

  if ((ctx.caster.specialState.samplePrepared ?? 0) <= 0) return true // 準備効果が成立していなければ終了する

  if (ctx.trigger === 'beforeAction') { // 所持武将の行動開始前か確認する
    h.addTimedModifier(ctx, ctx.caster, 'val', 20, 1, 1) // 自身の武勇を1ターン20上げる
    return true // このイベントの処理を終了する
  }

  if (ctx.trigger === 'onHealed') { // 戦法回復を受けた時か確認する
    h.addTimedModifier(ctx, ctx.caster, 'damageDealt', 5, 1, 1) // 自身の与ダメージを1ターン5%上げる
    return true // このイベントの処理を終了する
  }

  return true // 未使用のイベントでも個別処理済みとして終了する
}
```

## 8. 如水の現在仕様に沿った例

```ts
如水: defineBattleSkillMeta({ // 如水のメタ情報を登録する
  type: '受動', // 受動戦法として処理する
  triggers: ['beforeAction', 'onHealed'], // 行動開始前と戦法回復を受けた時に呼び出す
}),
```

```ts
case '如水': { // 黒田官兵衛の固有戦法を処理する
  const gainKisaku = (reason: string) => { // 奇策獲得処理を共通化する
    const stacks = ctx.caster.specialState.josuiKisakuStacks ?? 0 // 現在の奇策スタックを取得する
    if (stacks >= 8) return // 最大8スタックなら何もしない

    const intelligence = h.statOf(ctx.caster, 'int') // 現在の知略を取得する
    const chance = Math.min(0.9, 0.48 + Math.max(0, intelligence - 100) * 0.001) // 基礎48%・知略依存、上限90%で求める
    if (!h.roll(ctx.rng, chance)) return // 奇策獲得判定に失敗したら終了する

    const nextStacks = Math.min(8, stacks + 1) // 奇策を1つ増やし、8を上限にする
    ctx.caster.specialState.josuiKisakuStacks = nextStacks // 新しいスタック数を保存する

    setSpecialStateContribution( // 他の奇策率上昇効果と共存できる形で反映する
      ctx.caster, // 奇策を得る武将を指定する
      'strategyCriticalChance', // 計略最終ダメージが150%になる確率へ加算する
      'josuiStrategyCriticalChance', // 如水による加算分を識別するキーを指定する
      nextStacks * 5, // 1スタックにつき奇策率を5%上げる
    )

    log(ctx.logs, ctx, `如水: ${reason}で奇策を獲得（奇策率${nextStacks * 5}%）`) // 現在の奇策率をログへ表示する
  }

  if (ctx.trigger === 'beforeAction') { // 所持武将の行動開始前か確認する
    gainKisaku('行動前') // 行動開始前の奇策獲得判定を行う

    const target = h.chooseTarget(ctx.enemies, ctx.rng, ctx) // 生存中の敵から対象を選ぶ
    const damageChance = ctx.caster.role === 'main' ? 0.75 : 0.6 // 大将なら75%、副将なら60%にする
    if (target && h.roll(ctx.rng, damageChance)) { // 対象が存在し、ダメージ判定に成功したか確認する
      const hits = 1 + Math.floor(ctx.rng() * 2) // 攻撃回数を1～2回から決める
      for (let index = 0; index < hits; index += 1) { // 決めた回数だけ繰り返す
        h.dealSkillDamage(ctx, target, 88, 'strategy') // 対象へ88%の計略ダメージを与える
      }
    }
  }

  if (ctx.trigger === 'onHealed' && ctx.turn > 0) { // 準備ターン以外に戦法回復を受けたか確認する
    if (ctx.caster.specialState.josuiHealTurn !== ctx.turn) { // このターンにまだ回復反応していないか確認する
      ctx.caster.specialState.josuiHealTurn = ctx.turn // このターンの回復反応済みを記録する
      gainKisaku('このターン初めて戦法回復を受けた時') // 回復を受けた時の奇策獲得判定を行う
    }
  }

  return true // 個別処理済みとして終了する
}
```

奇策は計略与ダメージを固定加算する効果ではありません。奇策率が50%なら、50%の確率でその計略ダメージの最終値を150%にします。

## 9. 部隊全体や敵軍の行動を監視する戦法

所持武将以外の行動・被ダメージにも反応する戦法は、`case` とメタ情報だけでなく監視対象の一覧へ登録します。

```ts
export const TEAM_ACTION_BATTLE_SKILL_NAMES = new Set([ // 自軍各武将の行動を監視する兵種戦法
  'サンプル兵種戦法', // 所持者以外の行動開始時にもcaseを呼び出す
])

export const TEAM_NORMAL_ATTACK_RECEIVED_SKILL_NAMES = new Set([ // 自軍各武将の通常攻撃被弾を監視する戦法
  'サンプル被弾戦法', // 友軍が通常攻撃を受けた時にもcaseを呼び出す
])
```

必要な監視一覧は効果によって異なります。既存の類似戦法を探し、同じイベントを監視する一覧へ追加してください。

## 10. 実装時チェックリスト

1. `BATTLE_SKILL_EFFECT_META` に戦法タイプと全発動タイミングを登録する。
2. 複数タイミングでは、後続効果を `followUpTriggers` に入れるか確認する。
3. `applyNamedSkillEffect` に `case '戦法名'` を追加する。
4. S固有戦法は `battleUniqueSkillEffects.ts` に追加する。
5. ランダム対象と最低兵力対象を区別する。
6. 能動・突撃戦法の基本発動率を `case` 内で二重抽選しない。
7. 制御状態は `h.addControl`、一時効果は `h.addTimedModifier` を使う。
8. 部隊全体の行動を監視する効果は、対応する監視一覧にも登録する。
9. 最後に必ず `return true` を返す。
10. `pnpm run build` を実行し、データ検査と本番ビルドが成功することを確認する。
