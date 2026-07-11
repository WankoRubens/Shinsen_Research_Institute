export type HeroStatKey = 'lea' | 'val' | 'int' | 'pol' | 'cha' | 'spd'

export type HeroStatBlock = Record<HeroStatKey, number>

export interface HeroStatGrowthEntry {
  // レベル1時点の基本値。
  level1: HeroStatBlock
  // 1レベル上がるごとに増える値。
  growth: HeroStatBlock
}

// 武将の属性値を手で修正しやすいように集約するライブラリ。
//
// キーは武将名（name_jp / name / aliases のいずれか）で一致します。
// ここに登録した武将は level1 + growth * (level - 1) で計算します。
// 並び順は、勢力ごとに Cost が高い順です。
export const HERO_STAT_GROWTH: Record<string, HeroStatGrowthEntry> = {
  // 上杉
  '柿崎景家': {
    level1: { lea: 86.00, val: 95.00, int: 81.00, pol: 64.00, cha: 61.00, spd: 38.00 },
    growth: { lea: 1.44, val: 2.60, int: 1.15, pol: 0.95, cha: 0.91, spd: 1.37 },
  },
  '上杉謙信': {
    level1: { lea: 98.00, val: 100.00, int: 84.00, pol: 81.00, cha: 73.00, spd: 72.00 },
    growth: { lea: 1.80, val: 3.00, int: 0.81, pol: 1.98, cha: 1.69, spd: 1.35 },
  },
  '長野業正': {
    level1: { lea: 90.00, val: 90.00, int: 90.00, pol: 90.00, cha: 90.00, spd: 90.00 },
    growth: { lea: 1.23, val: 1.23, int: 1.23, pol: 1.23, cha: 1.23, spd: 1.23 },
  },
  '宇佐美定満': {
    level1: { lea: 83.00, val: 63.00, int: 92.00, pol: 66.00, cha: 63.00, spd: 54.00 },
    growth: { lea: 1.42, val: 1.01, int: 2.38, pol: 1.34, cha: 1.28, spd: 1.00 },
  },
  '甘粕景持': {
    level1: { lea: 81.00, val: 84.00, int: 83.00, pol: 54.00, cha: 73.00, spd: 54.00 },
    growth: { lea: 1.35, val: 2.08, int: 1.37, pol: 0.69, cha: 0.88, spd: 0.82 },
  },
  '太田資正': {
    level1: { lea: 82.00, val: 81.00, int: 79.00, pol: 56.00, cha: 42.00, spd: 73.00 },
    growth: { lea: 1.58, val: 2.01, int: 1.26, pol: 0.55, cha: 0.40, spd: 1.68 },
  },
  '小島弥太郎': {
    level1: { lea: 45.00, val: 91.00, int: 31.00, pol: 22.00, cha: 62.00, spd: 66.00 },
    growth: { lea: 1.21, val: 2.08, int: 0.53, pol: 0.26, cha: 0.52, spd: 0.80 },
  },
  '新発田重家': {
    level1: { lea: 71.00, val: 76.00, int: 82.00, pol: 47.00, cha: 80.00, spd: 46.00 },
    growth: { lea: 1.02, val: 0.88, int: 1.73, pol: 0.42, cha: 0.83, spd: 0.90 },
  },
  '水原親憲': {
    level1: { lea: 80.00, val: 70.00, int: 43.00, pol: 24.00, cha: 47.00, spd: 48.00 },
    growth: { lea: 1.79, val: 1.65, int: 0.74, pol: 0.70, cha: 0.33, spd: 1.21 },
  },
  '仙桃院': {
    level1: { lea: 61.00, val: 45.00, int: 56.00, pol: 70.00, cha: 76.00, spd: 52.00 },
    growth: { lea: 1.77, val: 0.44, int: 1.72, pol: 1.15, cha: 1.18, spd: 0.86 },
  },
  '千坂景親': {
    level1: { lea: 78.00, val: 72.00, int: 60.00, pol: 74.00, cha: 76.00, spd: 56.00 },
    growth: { lea: 1.76, val: 1.82, int: 0.93, pol: 0.84, cha: 0.91, spd: 0.81 },
  },
  '長野業盛': {
    level1: { lea: 72.00, val: 73.00, int: 51.00, pol: 43.00, cha: 45.00, spd: 42.00 },
    growth: { lea: 0.73, val: 1.24, int: 0.36, pol: 0.32, cha: 0.46, spd: 0.32 },
  },
  '樋口兼豊': {
    level1: { lea: 74.00, val: 59.00, int: 76.00, pol: 74.00, cha: 72.00, spd: 58.00 },
    growth: { lea: 1.32, val: 0.62, int: 1.82, pol: 0.82, cha: 0.77, spd: 1.31 },
  },
  '河田長親': {
    level1: { lea: 72.00, val: 44.00, int: 80.00, pol: 81.00, cha: 62.00, spd: 63.00 },
    growth: { lea: 1.52, val: 0.52, int: 1.76, pol: 1.72, cha: 1.08, spd: 1.29 },
  },
  '岩井信能': {
    level1: { lea: 31.00, val: 37.00, int: 46.00, pol: 66.00, cha: 75.00, spd: 35.00 },
    growth: { lea: 0.33, val: 0.42, int: 0.29, pol: 0.32, cha: 0.30, spd: 0.26 },
  },
  '甘粕景継': {
    level1: { lea: 76.00, val: 74.00, int: 36.00, pol: 38.00, cha: 10.00, spd: 49.00 },
    growth: { lea: 0.85, val: 1.62, int: 0.57, pol: 0.39, cha: 0.48, spd: 0.72 },
  },
  '色部勝長': {
    level1: { lea: 73.00, val: 77.00, int: 50.00, pol: 49.00, cha: 53.00, spd: 50.00 },
    growth: { lea: 0.89, val: 1.05, int: 0.42, pol: 0.55, cha: 0.50, spd: 0.51 },
  },
  '色部長実': {
    level1: { lea: 61.00, val: 60.00, int: 44.00, pol: 45.00, cha: 67.00, spd: 45.00 },
    growth: { lea: 0.76, val: 0.81, int: 0.36, pol: 0.23, cha: 0.61, spd: 0.52 },
  },
  '本庄実乃': {
    level1: { lea: 40.00, val: 46.00, int: 70.00, pol: 71.00, cha: 16.00, spd: 40.00 },
    growth: { lea: 0.45, val: 0.27, int: 1.32, pol: 0.68, cha: 0.12, spd: 0.34 },
  },

  // 武田
  '山県昌景': {
    level1: { lea: 93.00, val: 96.00, int: 81.00, pol: 70.00, cha: 62.00, spd: 79.00 },
    growth: { lea: 1.55, val: 2.61, int: 1.19, pol: 0.77, cha: 0.88, spd: 1.69 },
  },
  '真田昌幸': {
    level1: { lea: 94.00, val: 80.00, int: 99.00, pol: 85.00, cha: 99.00, spd: 45.00 },
    growth: { lea: 1.67, val: 0.52, int: 2.70, pol: 1.20, cha: 2.63, spd: 0.63 },
  },
  '武田信玄': {
    level1: { lea: 100.00, val: 89.00, int: 96.00, pol: 95.00, cha: 85.00, spd: 73.00 },
    growth: { lea: 2.09, val: 2.08, int: 2.00, pol: 2.61, cha: 1.79, spd: 1.34 },
  },
  '甘利虎泰': {
    level1: { lea: 75.00, val: 79.00, int: 62.00, pol: 64.00, cha: 55.00, spd: 43.00 },
    growth: { lea: 1.79, val: 1.97, int: 0.66, pol: 0.50, cha: 0.47, spd: 0.32 },
  },
  '山本勘助': {
    level1: { lea: 83.00, val: 69.00, int: 96.00, pol: 68.00, cha: 79.00, spd: 62.00 },
    growth: { lea: 1.46, val: 0.69, int: 2.62, pol: 0.89, cha: 1.68, spd: 1.12 },
  },
  '内藤昌豊': {
    level1: { lea: 78.00, val: 76.00, int: 87.00, pol: 74.00, cha: 52.00, spd: 42.00 },
    growth: { lea: 1.56, val: 0.51, int: 2.09, pol: 1.09, cha: 0.62, spd: 0.53 },
  },
  '馬場信春': {
    level1: { lea: 90.00, val: 85.00, int: 88.00, pol: 75.00, cha: 78.00, spd: 53.00 },
    growth: { lea: 2.30, val: 1.56, int: 1.68, pol: 1.49, cha: 1.48, spd: 0.99 },
  },
  '板垣信方': {
    level1: { lea: 83.00, val: 58.00, int: 81.00, pol: 74.00, cha: 78.00, spd: 29.00 },
    growth: { lea: 1.67, val: 0.62, int: 1.93, pol: 1.03, cha: 1.05, spd: 0.36 },
  },
  '飯富虎昌': {
    level1: { lea: 76.00, val: 90.00, int: 55.00, pol: 40.00, cha: 44.00, spd: 61.00 },
    growth: { lea: 1.23, val: 2.30, int: 0.81, pol: 0.49, cha: 0.38, spd: 0.97 },
  },
  '一条信龍': {
    level1: { lea: 74.00, val: 75.00, int: 70.00, pol: 75.00, cha: 78.00, spd: 56.00 },
    growth: { lea: 1.61, val: 1.66, int: 1.12, pol: 0.92, cha: 1.02, spd: 0.69 },
  },
  '岡部元信': {
    level1: { lea: 76.00, val: 78.00, int: 83.00, pol: 43.00, cha: 70.00, spd: 31.00 },
    growth: { lea: 1.12, val: 1.14, int: 1.95, pol: 0.59, cha: 1.38, spd: 0.65 },
  },
  '原虎胤': {
    level1: { lea: 71.00, val: 87.00, int: 61.00, pol: 24.00, cha: 46.00, spd: 37.00 },
    growth: { lea: 0.76, val: 1.99, int: 0.71, pol: 0.28, cha: 0.41, spd: 0.65 },
  },
  '小山田信茂': {
    level1: { lea: 72.00, val: 79.00, int: 75.00, pol: 50.00, cha: 75.00, spd: 55.00 },
    growth: { lea: 1.00, val: 1.73, int: 0.97, pol: 0.48, cha: 0.59, spd: 0.90 },
  },
  '多田三八郎': {
    level1: { lea: 67.00, val: 79.00, int: 73.00, pol: 30.00, cha: 38.00, spd: 62.00 },
    growth: { lea: 0.91, val: 1.63, int: 0.71, pol: 0.38, cha: 0.47, spd: 0.92 },
  },
  '保科正俊': {
    level1: { lea: 63.00, val: 79.00, int: 64.00, pol: 36.00, cha: 46.00, spd: 55.00 },
    growth: { lea: 1.02, val: 1.73, int: 0.84, pol: 0.66, cha: 0.55, spd: 0.89 },
  },
  '三枝昌貞': {
    level1: { lea: 79.00, val: 70.00, int: 68.00, pol: 61.00, cha: 53.00, spd: 56.00 },
    growth: { lea: 1.58, val: 1.25, int: 1.07, pol: 0.46, cha: 0.43, spd: 0.88 },
  },
  '諏訪姫': {
    level1: { lea: 63.00, val: 54.00, int: 64.00, pol: 43.00, cha: 56.00, spd: 50.00 },
    growth: { lea: 1.64, val: 0.42, int: 1.66, pol: 0.38, cha: 0.53, spd: 1.02 },
  },
  '武田義信': {
    level1: { lea: 61.00, val: 77.00, int: 42.00, pol: 45.00, cha: 49.00, spd: 68.00 },
    growth: { lea: 1.03, val: 1.66, int: 0.91, pol: 0.44, cha: 0.38, spd: 1.24 },
  },
  '小山田茂誠': {
    level1: { lea: 70.00, val: 63.00, int: 49.00, pol: 39.00, cha: 50.00, spd: 46.00 },
    growth: { lea: 1.56, val: 1.07, int: 0.71, pol: 0.42, cha: 0.51, spd: 0.68 },
  },

  // 織田
  '織田信長': {
    level1: { lea: 99.00, val: 88.00, int: 95.00, pol: 100.00, cha: 86.00, spd: 57.00 },
    growth: { lea: 2.70, val: 1.49, int: 1.63, pol: 3.00, cha: 1.85, spd: 1.08 },
  },
  '明智光秀': {
    level1: { lea: 96.00, val: 84.00, int: 93.00, pol: 97.00, cha: 93.00, spd: 68.00 },
    growth: { lea: 1.78, val: 1.14, int: 2.60, pol: 2.64, cha: 2.35, spd: 0.97 },
  },
  'まつ': {
    level1: { lea: 76.00, val: 50.00, int: 68.00, pol: 79.00, cha: 70.00, spd: 40.00 },
    growth: { lea: 1.66, val: 0.42, int: 2.01, pol: 2.38, cha: 1.57, spd: 0.51 },
  },
  '下方貞清': {
    level1: { lea: 69.00, val: 84.00, int: 34.00, pol: 13.00, cha: 31.00, spd: 61.00 },
    growth: { lea: 1.79, val: 1.87, int: 0.62, pol: 0.40, cha: 0.47, spd: 0.32 },
  },
  '帰蝶': {
    level1: { lea: 69.00, val: 51.00, int: 75.00, pol: 63.00, cha: 89.00, spd: 61.00 },
    growth: { lea: 1.88, val: 0.97, int: 2.09, pol: 1.22, cha: 2.30, spd: 1.59 },
  },
  '荒木村重': {
    level1: { lea: 77.00, val: 73.00, int: 84.00, pol: 60.00, cha: 39.00, spd: 34.00 },
    growth: { lea: 1.66, val: 0.36, int: 2.07, pol: 1.05, cha: 0.28, spd: 0.61 },
  },
  '佐久間信盛': {
    level1: { lea: 74.00, val: 68.00, int: 76.00, pol: 59.00, cha: 31.00, spd: 46.00 },
    growth: { lea: 2.03, val: 0.55, int: 1.72, pol: 0.66, cha: 0.41, spd: 0.81 },
  },
  '妻木煕子': {
    level1: { lea: 51.00, val: 39.00, int: 80.00, pol: 80.00, cha: 75.00, spd: 37.00 },
    growth: { lea: 1.32, val: 0.32, int: 2.09, pol: 1.78, cha: 1.64, spd: 0.46 },
  },
  '斎藤利三': {
    level1: { lea: 79.00, val: 75.00, int: 74.00, pol: 49.00, cha: 52.00, spd: 66.00 },
    growth: { lea: 1.49, val: 1.86, int: 1.19, pol: 0.44, cha: 0.43, spd: 0.38 },
  },
  '柴田勝家': {
    level1: { lea: 90.00, val: 94.00, int: 80.00, pol: 66.00, cha: 68.00, spd: 78.00 },
    growth: { lea: 1.46, val: 2.33, int: 1.19, pol: 1.12, cha: 1.24, spd: 1.82 },
  },
  '前田慶次': {
    level1: { lea: 64.00, val: 93.00, int: 71.00, pol: 33.00, cha: 56.00, spd: 63.00 },
    growth: { lea: 1.28, val: 2.31, int: 1.24, pol: 0.37, cha: 0.61, spd: 1.22 },
  },
  '前田利家': {
    level1: { lea: 83.00, val: 85.00, int: 66.00, pol: 86.00, cha: 73.00, spd: 58.00 },
    growth: { lea: 1.54, val: 2.06, int: 1.12, pol: 1.78, cha: 1.49, spd: 1.15 },
  },
  '太田牛一': {
    level1: { lea: 62.00, val: 85.00, int: 68.00, pol: 78.00, cha: 82.00, spd: 43.00 },
    growth: { lea: 1.01, val: 1.89, int: 1.03, pol: 1.06, cha: 1.29, spd: 0.39 },
  },
  '池田輝政': {
    level1: { lea: 68.00, val: 71.00, int: 71.00, pol: 78.00, cha: 37.00, spd: 59.00 },
    growth: { lea: 1.03, val: 1.81, int: 1.81, pol: 1.43, cha: 0.42, spd: 0.82 },
  },
  '明智秀満': {
    level1: { lea: 74.00, val: 80.00, int: 82.00, pol: 48.00, cha: 72.00, spd: 20.00 },
    growth: { lea: 1.49, val: 1.01, int: 2.04, pol: 0.50, cha: 0.93, spd: 0.83 },
  },
  '安藤守就': {
    level1: { lea: 41.00, val: 46.00, int: 71.00, pol: 64.00, cha: 59.00, spd: 55.00 },
    growth: { lea: 1.47, val: 0.34, int: 1.81, pol: 0.55, cha: 0.44, spd: 0.54 },
  },
  '稲葉一鉄': {
    level1: { lea: 77.00, val: 71.00, int: 78.00, pol: 71.00, cha: 73.00, spd: 29.00 },
    growth: { lea: 2.01, val: 0.62, int: 1.46, pol: 0.63, cha: 0.64, spd: 0.56 },
  },
  '佐久間盛政': {
    level1: { lea: 75.00, val: 86.00, int: 58.00, pol: 39.00, cha: 76.00, spd: 56.00 },
    growth: { lea: 1.03, val: 2.01, int: 0.51, pol: 0.42, cha: 0.55, spd: 0.77 },
  },
  '坂井政尚': {
    level1: { lea: 73.00, val: 82.00, int: 32.00, pol: 61.00, cha: 49.00, spd: 44.00 },
    growth: { lea: 1.33, val: 1.89, int: 0.37, pol: 0.51, cha: 0.46, spd: 0.91 },
  },
  '氏家卜全': {
    level1: { lea: 61.00, val: 68.00, int: 58.00, pol: 49.00, cha: 77.00, spd: 34.00 },
    growth: { lea: 1.77, val: 1.68, int: 0.73, pol: 0.43, cha: 0.53, spd: 0.90 },
  },
  '森可成': {
    level1: { lea: 75.00, val: 87.00, int: 67.00, pol: 49.00, cha: 59.00, spd: 64.00 },
    growth: { lea: 1.43, val: 2.08, int: 0.91, pol: 0.44, cha: 0.38, spd: 1.24 },
  },
  '池田恒興': {
    level1: { lea: 73.00, val: 72.00, int: 63.00, pol: 63.00, cha: 20.00, spd: 59.00 },
    growth: { lea: 1.02, val: 1.71, int: 0.89, pol: 0.72, cha: 0.40, spd: 1.18 },
  },
  '堀直政': {
    level1: { lea: 90.00, val: 90.00, int: 90.00, pol: 90.00, cha: 90.00, spd: 90.00 },
    growth: { lea: 1.23, val: 1.23, int: 1.23, pol: 1.23, cha: 1.23, spd: 1.23 },
  },
  '河尻秀隆': {
    level1: { lea: 53.00, val: 61.00, int: 62.00, pol: 64.00, cha: 52.00, spd: 51.00 },
    growth: { lea: 0.88, val: 0.78, int: 0.49, pol: 0.52, cha: 0.52, spd: 0.47 },
  },
  '山内一豊': {
    level1: { lea: 71.00, val: 74.00, int: 61.00, pol: 70.00, cha: 25.00, spd: 62.00 },
    growth: { lea: 0.90, val: 1.64, int: 0.78, pol: 0.31, cha: 0.35, spd: 1.08 },
  },
  '織田信雄': {
    level1: { lea: 37.00, val: 41.00, int: 29.00, pol: 59.00, cha: 62.00, spd: 43.00 },
    growth: { lea: 0.76, val: 0.81, int: 0.65, pol: 0.43, cha: 0.54, spd: 0.34 },
  },
  '池田せん': {
    level1: { lea: 54.00, val: 68.00, int: 63.00, pol: 45.00, cha: 64.00, spd: 58.00 },
    growth: { lea: 0.96, val: 1.36, int: 1.11, pol: 0.49, cha: 0.38, spd: 1.07 },
  },
  '不破光治': {
    level1: { lea: 76.00, val: 65.00, int: 74.00, pol: 58.00, cha: 77.00, spd: 31.00 },
    growth: { lea: 0.78, val: 0.32, int: 0.76, pol: 0.40, cha: 0.62, spd: 0.49 },
  },
  '林秀貞': {
    level1: { lea: 35.00, val: 40.00, int: 71.00, pol: 55.00, cha: 71.00, spd: 35.00 },
    growth: { lea: 0.91, val: 0.48, int: 1.08, pol: 0.53, cha: 0.38, spd: 0.46 },
  },
  'お市': {
    level1: { lea: 76.00, val: 52.00, int: 74.00, pol: 62.00, cha: 92.00, spd: 60.00 },
    growth: { lea: 1.07, val: 0.24, int: 1.68, pol: 0.83, cha: 2.33, spd: 0.76 },
  },
  '金森長近': {
    level1: { lea: 68.00, val: 60.00, int: 65.00, pol: 55.00, cha: 60.00, spd: 51.00 },
    growth: { lea: 0.71, val: 0.83, int: 0.75, pol: 0.61, cha: 0.52, spd: 0.62 },
  },
  '筒井順慶': {
    level1: { lea: 60.00, val: 47.00, int: 76.00, pol: 76.00, cha: 78.00, spd: 32.00 },
    growth: { lea: 0.59, val: 0.14, int: 1.35, pol: 0.62, cha: 0.66, spd: 0.43 },
  },

  // 徳川
  '酒井忠次': {
    level1: { lea: 86.00, val: 86.00, int: 75.00, pol: 60.00, cha: 52.00, spd: 56.00 },
    growth: { lea: 2.06, val: 2.06, int: 1.59, pol: 0.60, cha: 0.44, spd: 1.28 },
  },
  '徳川家康': {
    level1: { lea: 99.00, val: 87.00, int: 90.00, pol: 98.00, cha: 88.00, spd: 31.00 },
    growth: { lea: 2.70, val: 1.39, int: 1.61, pol: 2.68, cha: 1.89, spd: 0.62 },
  },
  '本多忠勝': {
    level1: { lea: 85.00, val: 98.00, int: 79.00, pol: 60.00, cha: 67.00, spd: 43.00 },
    growth: { lea: 1.71, val: 2.68, int: 0.75, pol: 0.83, cha: 0.96, spd: 0.78 },
  },
  'お江': {
    level1: { lea: 72.00, val: 48.00, int: 74.00, pol: 77.00, cha: 72.00, spd: 43.00 },
    growth: { lea: 1.67, val: 0.35, int: 1.94, pol: 1.45, cha: 1.68, spd: 0.58 },
  },
  '榊原康政': {
    level1: { lea: 85.00, val: 84.00, int: 82.00, pol: 67.00, cha: 46.00, spd: 74.00 },
    growth: { lea: 1.42, val: 1.99, int: 1.18, pol: 0.84, cha: 0.69, spd: 1.57 },
  },
  '松平信康': {
    level1: { lea: 74.00, val: 86.00, int: 65.00, pol: 57.00, cha: 84.00, spd: 67.00 },
    growth: { lea: 1.76, val: 1.89, int: 1.34, pol: 0.49, cha: 1.58, spd: 1.52 },
  },
  '結城秀康': {
    level1: { lea: 75.00, val: 82.00, int: 46.00, pol: 50.00, cha: 25.00, spd: 65.00 },
    growth: { lea: 1.67, val: 1.88, int: 0.42, pol: 0.86, cha: 0.22, spd: 0.78 },
  },
  '高力清長': {
    level1: { lea: 84.00, val: 67.00, int: 72.00, pol: 76.00, cha: 78.00, spd: 48.00 },
    growth: { lea: 1.95, val: 0.76, int: 1.56, pol: 1.05, cha: 1.12, spd: 0.58 },
  },
  '小幡景憲': {
    level1: { lea: 74.00, val: 78.00, int: 86.00, pol: 51.00, cha: 65.00, spd: 38.00 },
    growth: { lea: 1.49, val: 0.40, int: 1.77, pol: 0.92, cha: 0.96, spd: 0.89 },
  },
  '大久保長安': {
    level1: { lea: 90.00, val: 90.00, int: 90.00, pol: 90.00, cha: 90.00, spd: 90.00 },
    growth: { lea: 1.23, val: 1.23, int: 1.23, pol: 1.23, cha: 1.23, spd: 1.23 },
  },
  '鳥居元忠': {
    level1: { lea: 62.00, val: 69.00, int: 72.00, pol: 24.00, cha: 48.00, spd: 68.00 },
    growth: { lea: 1.82, val: 1.48, int: 1.23, pol: 0.56, cha: 0.42, spd: 0.80 },
  },
  '本多正信': {
    level1: { lea: 29.00, val: 29.00, int: 92.00, pol: 93.00, cha: 91.00, spd: 48.00 },
    growth: { lea: 1.11, val: 0.28, int: 2.04, pol: 2.33, cha: 2.31, spd: 0.78 },
  },
  '松平忠直': {
    level1: { lea: 69.00, val: 73.00, int: 38.00, pol: 30.00, cha: 18.00, spd: 57.00 },
    growth: { lea: 0.57, val: 1.06, int: 0.35, pol: 0.33, cha: 0.11, spd: 0.35 },
  },
  '大久保忠世': {
    level1: { lea: 77.00, val: 77.00, int: 67.00, pol: 38.00, cha: 31.00, spd: 66.00 },
    growth: { lea: 1.15, val: 1.88, int: 0.86, pol: 0.35, cha: 0.44, spd: 0.77 },
  },
  '内藤信成': {
    level1: { lea: 70.00, val: 56.00, int: 53.00, pol: 43.00, cha: 48.00, spd: 51.00 },
    growth: { lea: 1.05, val: 0.81, int: 0.49, pol: 0.53, cha: 0.42, spd: 0.52 },
  },

  // 豊臣
  '黒田官兵衛': {
    level1: { lea: 87.00, val: 78.00, int: 98.00, pol: 84.00, cha: 78.00, spd: 41.00 },
    growth: { lea: 1.63, val: 0.72, int: 2.67, pol: 1.51, cha: 1.45, spd: 0.55 },
  },
  '豊臣秀吉': {
    level1: { lea: 96.00, val: 81.00, int: 98.00, pol: 97.00, cha: 92.00, spd: 44.00 },
    growth: { lea: 1.72, val: 0.61, int: 2.66, pol: 2.65, cha: 2.34, spd: 0.76 },
  },
  'お初': {
    level1: { lea: 64.00, val: 50.00, int: 70.00, pol: 75.00, cha: 82.00, spd: 41.00 },
    growth: { lea: 1.62, val: 0.26, int: 2.06, pol: 1.66, cha: 1.43, spd: 0.56 },
  },
  'ねね': {
    level1: { lea: 77.00, val: 48.00, int: 80.00, pol: 74.00, cha: 76.00, spd: 42.00 },
    growth: { lea: 1.53, val: 0.20, int: 2.00, pol: 1.58, cha: 1.52, spd: 0.39 },
  },
  '加藤清正': {
    level1: { lea: 82.00, val: 89.00, int: 78.00, pol: 70.00, cha: 53.00, spd: 62.00 },
    growth: { lea: 1.56, val: 2.09, int: 0.94, pol: 1.27, cha: 0.88, spd: 1.12 },
  },
  '宮部継潤': {
    level1: { lea: 76.00, val: 50.00, int: 96.00, pol: 59.00, cha: 61.00, spd: 49.00 },
    growth: { lea: 1.57, val: 0.44, int: 2.30, pol: 1.00, cha: 1.14, spd: 0.58 },
  },
  '成田甲斐': {
    level1: { lea: 80.00, val: 83.00, int: 66.00, pol: 56.00, cha: 70.00, spd: 66.00 },
    growth: { lea: 1.33, val: 1.66, int: 1.05, pol: 0.82, cha: 1.48, spd: 1.05 },
  },
  '仙石権兵衛': {
    level1: { lea: 51.00, val: 84.00, int: 55.00, pol: 33.00, cha: 46.00, spd: 73.00 },
    growth: { lea: 1.13, val: 1.96, int: 0.98, pol: 0.31, cha: 0.48, spd: 1.89 },
  },
  '竹中半兵衛': {
    level1: { lea: 85.00, val: 70.00, int: 99.00, pol: 59.00, cha: 77.00, spd: 41.00 },
    growth: { lea: 1.33, val: 0.38, int: 2.69, pol: 0.73, cha: 1.64, spd: 0.71 },
  },
  '福島正則': {
    level1: { lea: 78.00, val: 91.00, int: 68.00, pol: 53.00, cha: 42.00, spd: 57.00 },
    growth: { lea: 1.48, val: 2.35, int: 1.07, pol: 0.77, cha: 0.60, spd: 1.22 },
  },
  '栗山善助': {
    level1: { lea: 70.00, val: 71.00, int: 81.00, pol: 71.00, cha: 54.00, spd: 58.00 },
    growth: { lea: 1.02, val: 0.96, int: 1.87, pol: 1.03, cha: 1.05, spd: 0.36 },
  },
  '蜂須賀小六': {
    level1: { lea: 66.00, val: 76.00, int: 83.00, pol: 72.00, cha: 66.00, spd: 42.00 },
    growth: { lea: 1.23, val: 1.83, int: 1.83, pol: 1.02, cha: 0.92, spd: 0.76 },
  },
  '横山喜内': {
    level1: { lea: 56.00, val: 72.00, int: 81.00, pol: 41.00, cha: 27.00, spd: 49.00 },
    growth: { lea: 0.86, val: 0.96, int: 1.66, pol: 1.05, cha: 0.48, spd: 0.61 },
  },
  '可児才蔵': {
    level1: { lea: 56.00, val: 85.00, int: 61.00, pol: 22.00, cha: 77.00, spd: 51.00 },
    growth: { lea: 0.84, val: 2.01, int: 0.88, pol: 0.20, cha: 0.78, spd: 0.89 },
  },
  '小早川秀秋': {
    level1: { lea: 62.00, val: 53.00, int: 64.00, pol: 62.00, cha: 63.00, spd: 47.00 },
    growth: { lea: 0.69, val: 1.03, int: 0.57, pol: 0.66, cha: 0.65, spd: 0.61 },
  },
  '蜂須賀家政': {
    level1: { lea: 61.00, val: 47.00, int: 76.00, pol: 81.00, cha: 80.00, spd: 34.00 },
    growth: { lea: 1.01, val: 0.28, int: 1.68, pol: 0.98, cha: 0.92, spd: 0.64 },
  },
  '加藤嘉明': {
    level1: { lea: 79.00, val: 75.00, int: 79.00, pol: 55.00, cha: 63.00, spd: 62.00 },
    growth: { lea: 1.14, val: 1.45, int: 1.41, pol: 0.83, cha: 0.98, spd: 0.74 },
  },
  '真田大助': {
    level1: { lea: 59.00, val: 71.00, int: 54.00, pol: 27.00, cha: 68.00, spd: 61.00 },
    growth: { lea: 0.82, val: 0.99, int: 0.48, pol: 0.15, cha: 0.62, spd: 0.22 },
  },
  '中村一氏': {
    level1: { lea: 57.00, val: 40.00, int: 53.00, pol: 66.00, cha: 50.00, spd: 31.00 },
    growth: { lea: 0.66, val: 0.29, int: 0.37, pol: 0.28, cha: 0.27, spd: 0.36 },
  },
  '片桐且元': {
    level1: { lea: 46.00, val: 69.00, int: 46.00, pol: 60.00, cha: 66.00, spd: 22.00 },
    growth: { lea: 0.34, val: 0.66, int: 0.29, pol: 0.24, cha: 0.34, spd: 0.33 },
  },
  '脇坂安治': {
    level1: { lea: 60.00, val: 69.00, int: 54.00, pol: 43.00, cha: 42.00, spd: 46.00 },
    growth: { lea: 0.92, val: 1.48, int: 1.45, pol: 0.46, cha: 0.38, spd: 0.97 },
  },

  // 群雄
  '伊達政宗': {
    level1: { lea: 90.00, val: 90.00, int: 90.00, pol: 90.00, cha: 90.00, spd: 90.00 },
    growth: { lea: 1.23, val: 1.23, int: 1.23, pol: 1.23, cha: 1.23, spd: 1.23 },
  },
  '今川義元': {
    level1: { lea: 94.00, val: 85.00, int: 88.00, pol: 94.00, cha: 95.00, spd: 70.00 },
    growth: { lea: 2.04, val: 1.82, int: 1.82, pol: 2.39, cha: 2.60, spd: 1.27 },
  },
  '佐竹義重': {
    level1: { lea: 90.00, val: 90.00, int: 90.00, pol: 90.00, cha: 90.00, spd: 90.00 },
    growth: { lea: 1.23, val: 1.23, int: 1.23, pol: 1.23, cha: 1.23, spd: 1.23 },
  },
  '松永久秀': {
    level1: { lea: 86.00, val: 72.00, int: 94.00, pol: 90.00, cha: 72.00, spd: 59.00 },
    growth: { lea: 1.77, val: 0.84, int: 2.62, pol: 2.04, cha: 1.59, spd: 1.05 },
  },
  '長宗我部元親': {
    level1: { lea: 89.00, val: 91.00, int: 87.00, pol: 89.00, cha: 83.00, spd: 51.00 },
    growth: { lea: 2.01, val: 1.97, int: 1.32, pol: 2.03, cha: 1.98, spd: 0.92 },
  },
  '陶晴賢': {
    level1: { lea: 85.00, val: 85.00, int: 79.00, pol: 67.00, cha: 62.00, spd: 48.00 },
    growth: { lea: 1.65, val: 2.05, int: 1.42, pol: 1.13, cha: 1.01, spd: 0.76 },
  },
  '北条綱成': {
    level1: { lea: 91.00, val: 96.00, int: 84.00, pol: 61.00, cha: 71.00, spd: 73.00 },
    growth: { lea: 1.51, val: 2.62, int: 1.44, pol: 1.18, cha: 1.32, spd: 1.65 },
  },
  '本願寺顕如': {
    level1: { lea: 84.00, val: 68.00, int: 82.00, pol: 94.00, cha: 92.00, spd: 42.00 },
    growth: { lea: 2.01, val: 1.05, int: 2.01, pol: 2.35, cha: 2.31, spd: 0.73 },
  },
  '毛利元就': {
    level1: { lea: 98.00, val: 82.00, int: 100.00, pol: 93.00, cha: 88.00, spd: 36.00 },
    growth: { lea: 1.68, val: 0.58, int: 3.00, pol: 2.38, cha: 1.89, spd: 0.55 },
  },
  '立花道雪': {
    level1: { lea: 92.00, val: 91.00, int: 88.00, pol: 75.00, cha: 64.00, spd: 71.00 },
    growth: { lea: 1.66, val: 2.09, int: 1.23, pol: 1.56, cha: 1.41, spd: 1.01 },
  },
  '立花誾千代': {
    level1: { lea: 75.00, val: 86.00, int: 68.00, pol: 61.00, cha: 72.00, spd: 59.00 },
    growth: { lea: 1.53, val: 2.33, int: 1.39, pol: 0.98, cha: 1.35, spd: 1.06 },
  },
  '伊達晴宗': {
    level1: { lea: 82.00, val: 81.00, int: 76.00, pol: 82.00, cha: 72.00, spd: 62.00 },
    growth: { lea: 1.52, val: 2.04, int: 1.16, pol: 1.72, cha: 1.48, spd: 1.02 },
  },
  '遠藤直経': {
    level1: { lea: 71.00, val: 82.00, int: 77.00, pol: 24.00, cha: 63.00, spd: 71.00 },
    growth: { lea: 1.17, val: 1.96, int: 1.15, pol: 0.23, cha: 0.56, spd: 1.16 },
  },
  '鬼庭左月斎': {
    level1: { lea: 77.00, val: 76.00, int: 81.00, pol: 40.00, cha: 74.00, spd: 39.00 },
    growth: { lea: 1.83, val: 0.83, int: 1.84, pol: 0.55, cha: 1.03, spd: 0.59 },
  },
  '九戸政実': {
    level1: { lea: 77.00, val: 83.00, int: 62.00, pol: 43.00, cha: 71.00, spd: 54.00 },
    growth: { lea: 1.35, val: 1.98, int: 0.99, pol: 0.51, cha: 0.47, spd: 0.94 },
  },
  '高橋紹運': {
    level1: { lea: 88.00, val: 93.00, int: 83.00, pol: 62.00, cha: 66.00, spd: 62.00 },
    growth: { lea: 1.95, val: 1.97, int: 1.74, pol: 0.70, cha: 0.78, spd: 0.92 },
  },
  '三好實休': {
    level1: { lea: 90.00, val: 90.00, int: 90.00, pol: 90.00, cha: 90.00, spd: 90.00 },
    growth: { lea: 1.23, val: 1.23, int: 1.23, pol: 1.23, cha: 1.23, spd: 1.23 },
  },
  '寿桂尼': {
    level1: { lea: 74.00, val: 29.00, int: 83.00, pol: 86.00, cha: 75.00, spd: 22.00 },
    growth: { lea: 1.52, val: 0.12, int: 2.04, pol: 1.85, cha: 1.29, spd: 0.24 },
  },
  '真柄直隆': {
    level1: { lea: 47.00, val: 87.00, int: 61.00, pol: 25.00, cha: 31.00, spd: 59.00 },
    growth: { lea: 1.25, val: 2.34, int: 1.05, pol: 0.15, cha: 0.53, spd: 0.83 },
  },
  '浅井長政': {
    level1: { lea: 84.00, val: 83.00, int: 76.00, pol: 53.00, cha: 69.00, spd: 58.00 },
    growth: { lea: 1.57, val: 2.06, int: 1.08, pol: 0.64, cha: 1.08, spd: 1.33 },
  },
  '大祝鶴': {
    level1: { lea: 74.00, val: 85.00, int: 72.00, pol: 36.00, cha: 40.00, spd: 43.00 },
    growth: { lea: 1.42, val: 1.75, int: 1.42, pol: 0.38, cha: 0.46, spd: 0.65 },
  },
  '大内義隆': {
    level1: { lea: 75.00, val: 50.00, int: 68.00, pol: 85.00, cha: 81.00, spd: 43.00 },
    growth: { lea: 1.97, val: 0.58, int: 1.68, pol: 1.93, cha: 1.44, spd: 0.62 },
  },
  '島津貴久': {
    level1: { lea: 81.00, val: 62.00, int: 80.00, pol: 84.00, cha: 74.00, spd: 48.00 },
    growth: { lea: 1.62, val: 0.77, int: 1.99, pol: 1.85, cha: 1.52, spd: 0.73 },
  },
  '福留親政': {
    level1: { lea: 71.00, val: 86.00, int: 66.00, pol: 31.00, cha: 28.00, spd: 68.00 },
    growth: { lea: 1.16, val: 1.92, int: 0.83, pol: 0.44, cha: 0.51, spd: 0.81 },
  },
  '北条氏康': {
    level1: { lea: 96.00, val: 87.00, int: 86.00, pol: 95.00, cha: 79.00, spd: 56.00 },
    growth: { lea: 1.76, val: 1.02, int: 2.02, pol: 2.62, cha: 1.76, spd: 0.89 },
  },
  '毛利輝元': {
    level1: { lea: 50.00, val: 56.00, int: 41.00, pol: 69.00, cha: 69.00, spd: 29.00 },
    growth: { lea: 1.97, val: 0.92, int: 1.73, pol: 1.15, cha: 1.15, spd: 0.36 },
  },
  '鈴木佐大夫': {
    level1: { lea: 80.00, val: 84.00, int: 79.00, pol: 57.00, cha: 77.00, spd: 56.00 },
    growth: { lea: 1.45, val: 1.94, int: 1.59, pol: 0.86, cha: 1.48, spd: 0.96 },
  },
  '鈴木重朝': {
    level1: { lea: 75.00, val: 79.00, int: 77.00, pol: 33.00, cha: 38.00, spd: 38.00 },
    growth: { lea: 1.49, val: 1.35, int: 1.95, pol: 0.42, cha: 0.55, spd: 0.88 },
  },
  '安宅冬康': {
    level1: { lea: 65.00, val: 50.00, int: 70.00, pol: 71.00, cha: 64.00, spd: 51.00 },
    growth: { lea: 1.63, val: 0.44, int: 1.86, pol: 1.46, cha: 1.15, spd: 0.67 },
  },
  '安東愛季': {
    level1: { lea: 82.00, val: 70.00, int: 82.00, pol: 85.00, cha: 76.00, spd: 43.00 },
    growth: { lea: 1.88, val: 0.82, int: 1.88, pol: 1.89, cha: 1.52, spd: 0.56 },
  },
  '伊達輝宗': {
    level1: { lea: 63.00, val: 55.00, int: 53.00, pol: 77.00, cha: 71.00, spd: 54.00 },
    growth: { lea: 1.84, val: 0.52, int: 1.65, pol: 1.58, cha: 1.44, spd: 0.70 },
  },
  '磯野員昌': {
    level1: { lea: 72.00, val: 85.00, int: 67.00, pol: 29.00, cha: 21.00, spd: 61.00 },
    growth: { lea: 0.88, val: 1.63, int: 0.41, pol: 0.23, cha: 0.20, spd: 1.09 },
  },
  '岩城親隆': {
    level1: { lea: 74.00, val: 68.00, int: 76.00, pol: 59.00, cha: 55.00, spd: 46.00 },
    growth: { lea: 1.47, val: 0.55, int: 1.76, pol: 0.43, cha: 0.44, spd: 0.56 },
  },
  '国司元相': {
    level1: { lea: 64.00, val: 73.00, int: 49.00, pol: 81.00, cha: 71.00, spd: 51.00 },
    growth: { lea: 1.09, val: 1.71, int: 0.51, pol: 1.50, cha: 0.93, spd: 1.00 },
  },
  '今川氏真': {
    level1: { lea: 22.00, val: 33.00, int: 21.00, pol: 59.00, cha: 75.00, spd: 23.00 },
    growth: { lea: 0.49, val: 0.21, int: 0.48, pol: 0.38, cha: 0.28, spd: 0.35 },
  },
  '斎藤義龍': {
    level1: { lea: 78.00, val: 77.00, int: 74.00, pol: 60.00, cha: 51.00, spd: 53.00 },
    growth: { lea: 1.77, val: 1.76, int: 1.39, pol: 1.53, cha: 1.02, spd: 1.12 },
  },
  '三好長逸': {
    level1: { lea: 60.00, val: 52.00, int: 58.00, pol: 56.00, cha: 50.00, spd: 25.00 },
    growth: { lea: 0.48, val: 0.36, int: 0.41, pol: 0.26, cha: 0.39, spd: 0.34 },
  },
  '十河一存': {
    level1: { lea: 80.00, val: 92.00, int: 71.00, pol: 36.00, cha: 32.00, spd: 59.00 },
    growth: { lea: 0.88, val: 2.31, int: 0.68, pol: 0.38, cha: 0.31, spd: 0.95 },
  },
  '瑞渓院': {
    level1: { lea: 62.00, val: 34.00, int: 59.00, pol: 67.00, cha: 63.00, spd: 58.00 },
    growth: { lea: 1.56, val: 0.23, int: 1.72, pol: 1.35, cha: 1.07, spd: 0.39 },
  },
  '成田長親': {
    level1: { lea: 52.00, val: 31.00, int: 54.00, pol: 48.00, cha: 65.00, spd: 19.00 },
    growth: { lea: 0.32, val: 0.18, int: 0.52, pol: 0.41, cha: 0.31, spd: 0.32 },
  },
  '相馬盛胤': {
    level1: { lea: 81.00, val: 76.00, int: 61.00, pol: 63.00, cha: 59.00, spd: 60.00 },
    growth: { lea: 1.53, val: 1.82, int: 0.75, pol: 0.87, cha: 0.74, spd: 0.95 },
  },
  '津田算長': {
    level1: { lea: 66.00, val: 74.00, int: 66.00, pol: 62.00, cha: 75.00, spd: 52.00 },
    growth: { lea: 1.62, val: 1.68, int: 1.62, pol: 0.88, cha: 1.43, spd: 0.85 },
  },
  '藤林正保': {
    level1: { lea: 90.00, val: 90.00, int: 90.00, pol: 90.00, cha: 90.00, spd: 90.00 },
    growth: { lea: 1.23, val: 1.23, int: 1.23, pol: 1.23, cha: 1.23, spd: 1.23 },
  },
  '南部晴政': {
    level1: { lea: 84.00, val: 80.00, int: 47.00, pol: 40.00, cha: 76.00, spd: 64.00 },
    growth: { lea: 1.64, val: 1.81, int: 0.66, pol: 1.28, cha: 1.56, spd: 1.79 },
  },
  '尼子晴久': {
    level1: { lea: 78.00, val: 59.00, int: 77.00, pol: 75.00, cha: 59.00, spd: 36.00 },
    growth: { lea: 1.72, val: 1.26, int: 1.73, pol: 1.33, cha: 1.05, spd: 0.46 },
  },
  '福原貞俊': {
    level1: { lea: 68.00, val: 53.00, int: 80.00, pol: 82.00, cha: 86.00, spd: 54.00 },
    growth: { lea: 1.19, val: 0.45, int: 1.74, pol: 1.44, cha: 1.59, spd: 0.54 },
  },
  '毛利隆元': {
    level1: { lea: 80.00, val: 67.00, int: 78.00, pol: 87.00, cha: 88.00, spd: 38.00 },
    growth: { lea: 1.74, val: 0.52, int: 1.78, pol: 1.66, cha: 1.68, spd: 0.36 },
  },
  '井伊直親': {
    level1: { lea: 62.00, val: 32.00, int: 55.00, pol: 59.00, cha: 51.00, spd: 28.00 },
    growth: { lea: 0.62, val: 0.16, int: 0.46, pol: 0.31, cha: 0.33, spd: 0.37 },
  },
  '浦上宗景': {
    level1: { lea: 90.00, val: 90.00, int: 90.00, pol: 90.00, cha: 90.00, spd: 90.00 },
    growth: { lea: 1.23, val: 1.23, int: 1.23, pol: 1.23, cha: 1.23, spd: 1.23 },
  },
  '吉川広家': {
    level1: { lea: 60.00, val: 55.00, int: 77.00, pol: 81.00, cha: 43.00, spd: 54.00 },
    growth: { lea: 1.68, val: 0.36, int: 1.74, pol: 1.61, cha: 0.46, spd: 0.38 },
  },
  '斎藤龍興': {
    level1: { lea: 24.00, val: 36.00, int: 32.00, pol: 36.00, cha: 72.00, spd: 24.00 },
    growth: { lea: 0.38, val: 0.34, int: 0.47, pol: 0.23, cha: 0.32, spd: 0.41 },
  },
  '朝倉義景': {
    level1: { lea: 41.00, val: 34.00, int: 42.00, pol: 51.00, cha: 56.00, spd: 66.00 },
    growth: { lea: 1.41, val: 0.39, int: 1.42, pol: 1.42, cha: 1.49, spd: 1.88 },
  },
  '尼子義久': {
    level1: { lea: 29.00, val: 38.00, int: 37.00, pol: 38.00, cha: 72.00, spd: 26.00 },
    growth: { lea: 0.30, val: 0.32, int: 0.31, pol: 0.29, cha: 0.25, spd: 0.40 },
  },
  '本願寺教如': {
    level1: { lea: 73.00, val: 56.00, int: 71.00, pol: 68.00, cha: 59.00, spd: 47.00 },
    growth: { lea: 0.88, val: 0.31, int: 0.97, pol: 0.51, cha: 0.38, spd: 0.44 },
  },
  '里見義堯': {
    level1: { lea: 85.00, val: 75.00, int: 85.00, pol: 56.00, cha: 52.00, spd: 46.00 },
    growth: { lea: 1.64, val: 0.64, int: 1.64, pol: 0.88, cha: 0.68, spd: 0.70 },
  },
  '遠藤基信': {
    level1: { lea: 37.00, val: 43.00, int: 70.00, pol: 81.00, cha: 58.00, spd: 47.00 },
    growth: { lea: 0.83, val: 0.28, int: 0.84, pol: 0.64, cha: 0.30, spd: 0.20 },
  },
  '口羽通良': {
    level1: { lea: 42.00, val: 49.00, int: 79.00, pol: 75.00, cha: 68.00, spd: 60.00 },
    growth: { lea: 0.81, val: 0.66, int: 0.79, pol: 0.58, cha: 0.45, spd: 0.64 },
  },
  '杉浦玄任': {
    level1: { lea: 72.00, val: 78.00, int: 66.00, pol: 63.00, cha: 23.00, spd: 59.00 },
    growth: { lea: 0.76, val: 1.04, int: 0.65, pol: 0.62, cha: 0.21, spd: 0.58 },
  },
  '弓足軽': {
    level1: { lea: 10.00, val: 10.00, int: 10.00, pol: 1.00, cha: 1.00, spd: 10.00 },
    growth: { lea: 0.10, val: 0.10, int: 0.10, pol: 0.10, cha: 0.10, spd: 0.10 },
  },
  '槍足軽': {
    level1: { lea: 10.00, val: 10.00, int: 10.00, pol: 1.00, cha: 1.00, spd: 10.00 },
    growth: { lea: 0.10, val: 0.10, int: 0.10, pol: 0.10, cha: 0.10, spd: 0.10 },
  },
  '偵察騎兵': {
    level1: { lea: 10.00, val: 10.00, int: 10.00, pol: 1.00, cha: 1.00, spd: 10.00 },
    growth: { lea: 0.10, val: 0.10, int: 0.10, pol: 0.10, cha: 0.10, spd: 0.10 },
  },
  '鉄砲足軽': {
    level1: { lea: 10.00, val: 10.00, int: 10.00, pol: 1.00, cha: 1.00, spd: 10.00 },
    growth: { lea: 0.10, val: 0.10, int: 0.10, pol: 0.10, cha: 0.10, spd: 0.10 },
  },

}
