interface EventSkillReference {
  name: string
  name_jp?: string | null
  is_event_skill?: boolean
}

// 事件戦法の交換に必要な武将心得。表示用データを戦闘ロジックから分離し、修正しやすくする。
export const EVENT_SKILL_MATERIALS: Readonly<Record<string, string>> = {
  '姻戚同盟': 'お市×1／浅井家・星5×1',
  '離心の計': '稲葉一鉄×1／織田家・星4×10',
  '城盗り': '竹中半兵衛×1／斎藤家・星5×1',
  '機に乗ず': '今川家・星5×1／徳川家・星5×1',
  '大器の萌芽': '織田家・星4×10',
  '自立の志': '毛利隆元×1／毛利家・星5×1',
  '専横専断': '大内家・星5×2',
  '家中整序': '群雄・星4×10',
  '破天の轟': '群雄・星4×10',
  '雷神斬り': '立花道雪×1／大友家・星5×1',
  '南蛮渡来': '群雄・星4×10',
  '疑心暗鬼': '松永久秀×1／三好家・星5×1',
  '直諫敢行': '馬場信春×1／武田家・星5×1',
  '会盟の陣': '武田家・星5×1／今川家・星5×1／北条家・星5×1',
  '出奇制勝': '山本勘助×1／武田家・星5×1',
  '三河武士': '酒井忠次・榊原康政・本多忠勝のいずれか×1',
  '越後先手組': '上杉家・星5×3',
  '追い崩し': '上杉家または北条家・星5×2',
}

export const eventSkillMaterial = (skill: EventSkillReference): string => {
  if (!skill.is_event_skill) return ''
  return EVENT_SKILL_MATERIALS[skill.name_jp || '']
    || EVENT_SKILL_MATERIALS[skill.name]
    || '素材情報未登録'
}
