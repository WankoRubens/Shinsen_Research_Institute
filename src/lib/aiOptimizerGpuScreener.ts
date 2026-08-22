import type { Lineup } from '../composables/useLineups'
import type { BingxueOption, Hero, Skill } from '../composables/useData'
import { snapshotAiLineup, type AiWorkerLineupSnapshot } from './aiOptimizerWorkerTypes'
import { AI_GPU_FEATURE_COUNT } from './aiOptimizerGpuFeatures'
import { AiOptimizerGpuFeatureWorkerPool } from './aiOptimizerGpuFeatureWorkerPool'

const FEATURE_COUNT = AI_GPU_FEATURE_COUNT
// 1候補を1ワークグループへ割り当て、概算戦闘を256スレッドで同時評価する。
const WORKGROUP_SIZE = 256
const APPROXIMATE_TURNS = 8
export const AI_GPU_SCREEN_SCENARIOS = 1024
// 1024通りの評価は重いため、WindowsのGPUタイムアウトを避けられる単位に分割する。
export const AI_GPU_SCREEN_CHUNK_SIZE = 512

const GPU_BUFFER_USAGE = {
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
} as const
const GPU_MAP_MODE_READ = 0x0001

type WebGpuNavigator = Navigator & {
  gpu?: {
    requestAdapter: (options?: { powerPreference?: 'high-performance' | 'low-power' }) => Promise<any>
  }
}

const GPU_SHADER = /* wgsl */ `
struct Params {
  candidateCount: u32,
  templateCount: u32,
  featureCount: u32,
  padding: u32,
}

@group(0) @binding(0) var<storage, read> candidates: array<f32>;
@group(0) @binding(1) var<storage, read> templates: array<f32>;
@group(0) @binding(2) var<storage, read_write> scores: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;
var<workgroup> candidateFeatures: array<f32, ${FEATURE_COUNT}>;
var<workgroup> partialScores: array<f32, ${WORKGROUP_SIZE}>;

// 同じ候補は毎回同じ結果になり、候補間では異なる疑似乱数を返す。
fn random01(seed: u32) -> f32 {
  var value = seed;
  value ^= value >> 16u;
  value *= 0x7feb352du;
  value ^= value >> 15u;
  value *= 0x846ca68bu;
  value ^= value >> 16u;
  return f32(value & 0x00ffffffu) / 16777216.0;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(
  @builtin(workgroup_id) workgroupId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>,
) {
  let candidateIndex = workgroupId.x;
  let lane = localId.x;
  let candidateBase = candidateIndex * params.featureCount;

  // 候補側の8特徴量はワークグループ内で共有し、同じ値の読み直しを減らす。
  if (lane < params.featureCount) {
    candidateFeatures[lane] = candidates[candidateBase + lane];
  }
  workgroupBarrier();

  var totalScore = 0.0;
  let ownPhysical = candidateFeatures[0u];
  let ownStrategy = candidateFeatures[1u];
  let ownDefense = candidateFeatures[2u];
  let ownSpeed = candidateFeatures[3u];
  let ownSustain = candidateFeatures[4u];
  let ownControl = candidateFeatures[5u];
  let ownReliability = candidateFeatures[6u];
  let ownVersatility = candidateFeatures[7u];

  // 候補ごとに21テンプレ×1024通りを分担し、発動の揺れを含む8ターン概算を行う。
  let jobCount = params.templateCount * ${AI_GPU_SCREEN_SCENARIOS}u;
  for (var jobIndex = lane; jobIndex < jobCount; jobIndex += ${WORKGROUP_SIZE}u) {
    let templateIndex = jobIndex % params.templateCount;
    let scenarioIndex = jobIndex / params.templateCount;
    let templateBase = templateIndex * params.featureCount;
    let enemyPhysical = templates[templateBase + 0u];
    let enemyStrategy = templates[templateBase + 1u];
    let enemyDefense = templates[templateBase + 2u];
    let enemySpeed = templates[templateBase + 3u];
    let enemySustain = templates[templateBase + 4u];
    let enemyControl = templates[templateBase + 5u];
    let enemyReliability = templates[templateBase + 6u];
    let enemyVersatility = templates[templateBase + 7u];

    let ownPressure = ownPhysical * 0.52 + ownStrategy * 0.48 + ownControl * 0.14 + ownReliability * 0.10;
    let enemyPressure = enemyPhysical * 0.52 + enemyStrategy * 0.48 + enemyControl * 0.14 + enemyReliability * 0.10;
    let ownGuard = ownDefense * 0.82 + ownSustain * 0.26;
    let enemyGuard = enemyDefense * 0.82 + enemySustain * 0.26;

    let pressureEdge = (ownPressure - enemyGuard - enemyPressure + ownGuard) * 0.030;
    let speedEdge = (ownSpeed - enemySpeed) * 0.020;
    let utilityEdge = (ownControl - enemyControl) * 0.050
      + (ownReliability - enemyReliability) * 0.035
      + (ownVersatility - enemyVersatility) * 0.025;
    var scenarioScore = 50.0 + pressureEdge + speedEdge + utilityEdge;

    let ownProcChance = clamp(0.28 + ownReliability * 0.0018, 0.18, 0.92);
    let enemyProcChance = clamp(0.28 + enemyReliability * 0.0018, 0.18, 0.92);
    let ownControlChance = clamp(ownControl * 0.0012, 0.0, 0.55);
    let enemyControlChance = clamp(enemyControl * 0.0012, 0.0, 0.55);
    let ownRoundValue = 0.8 + ownVersatility * 0.0025 + ownSustain * 0.0015;
    let enemyRoundValue = 0.8 + enemyVersatility * 0.0025 + enemySustain * 0.0015;

    for (var turn = 0u; turn < ${APPROXIMATE_TURNS}u; turn += 1u) {
      let baseSeed = candidateIndex * 747796405u
        + templateIndex * 2891336453u
        + scenarioIndex * 277803737u
        + turn * 1402946737u;
      let ownProc = random01(baseSeed + 1u);
      let enemyProc = random01(baseSeed + 2u);
      let ownControlRoll = random01(baseSeed + 3u);
      let enemyControlRoll = random01(baseSeed + 4u);

      if (ownProc < ownProcChance) {
        scenarioScore += ownRoundValue;
      }
      if (enemyProc < enemyProcChance) {
        scenarioScore -= enemyRoundValue;
      }
      if (ownControlRoll < ownControlChance) {
        scenarioScore += 0.9;
      }
      if (enemyControlRoll < enemyControlChance) {
        scenarioScore -= 0.9;
      }
    }
    totalScore += clamp(scenarioScore, 0.0, 100.0);
  }

  partialScores[lane] = totalScore;
  workgroupBarrier();

  // 32スレッド分の結果をワークグループ内で二分木状に合計する。
  var stride = ${WORKGROUP_SIZE / 2}u;
  loop {
    if (stride == 0u) {
      break;
    }
    if (lane < stride) {
      partialScores[lane] += partialScores[lane + stride];
    }
    workgroupBarrier();
    stride /= 2u;
  }

  if (lane == 0u) {
    scores[candidateIndex] = partialScores[0u] / max(1.0, f32(jobCount));
  }
}
`

export class AiOptimizerGpuScreener {
  private destroyed = false

  private constructor(
    private readonly device: any,
    private readonly pipeline: any,
    private readonly templateBuffer: any,
    private readonly templateCount: number,
    private readonly featureWorkers: AiOptimizerGpuFeatureWorkerPool,
  ) {}

  // 特徴量WorkerとGPU読み戻しを同時進行させるバッチ数。
  readonly maxInFlightBatches = 4

  static async create(
    heroes: Hero[],
    skills: Skill[],
    templates: AiWorkerLineupSnapshot[],
    bingxueCatalog: Record<string, BingxueOption>,
  ): Promise<AiOptimizerGpuScreener | null> {
    const gpu = (typeof navigator === 'undefined' ? undefined : (navigator as WebGpuNavigator).gpu)
    if (!gpu || templates.length === 0) return null

    let device: any = null
    let featureWorkers: AiOptimizerGpuFeatureWorkerPool | null = null
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
        ?? await gpu.requestAdapter()
      if (!adapter) return null
      device = await adapter.requestDevice()
      const module = device.createShaderModule({ code: GPU_SHADER })
      if (typeof module.getCompilationInfo === 'function') {
        const info = await module.getCompilationInfo()
        if (info.messages?.some((message: { type: string }) => message.type === 'error')) {
          device.destroy()
          return null
        }
      }
      const pipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      })
      featureWorkers = new AiOptimizerGpuFeatureWorkerPool(heroes, skills, bingxueCatalog)
      const templateFeatures = await featureWorkers.build(templates)
      // テンプレ特徴量は全バッチ共通なので、GPUメモリへ一度だけ転送して再利用する。
      const templateBuffer = device.createBuffer({
        size: templateFeatures.byteLength,
        usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
      })
      device.queue.writeBuffer(templateBuffer, 0, templateFeatures)
      return new AiOptimizerGpuScreener(
        device,
        pipeline,
        templateBuffer,
        templates.length,
        featureWorkers,
      )
    } catch {
      featureWorkers?.destroy()
      device?.destroy()
      return null
    }
  }

  async scoreBatch(lineups: Lineup[]): Promise<Float32Array> {
    if (this.destroyed) throw new Error('GPU一次選別を終了しました。')
    if (lineups.length === 0) return new Float32Array()

    // 特徴量は専用Workerで作り、GPUへそのまま転送できるFloat32配列として受け取る。
    const candidateFeatures = await this.featureWorkers.build(lineups.map(snapshotAiLineup))

    const candidateBuffer = this.device.createBuffer({
      size: candidateFeatures.byteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
    })
    const scoreBuffer = this.device.createBuffer({
      size: lineups.length * Float32Array.BYTES_PER_ELEMENT,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC,
    })
    const readBuffer = this.device.createBuffer({
      size: lineups.length * Float32Array.BYTES_PER_ELEMENT,
      usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ,
    })
    const paramsBuffer = this.device.createBuffer({
      size: 16,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    })

    try {
      this.device.queue.writeBuffer(candidateBuffer, 0, candidateFeatures)
      this.device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([
        lineups.length,
        this.templateCount,
        FEATURE_COUNT,
        0,
      ]))

      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: candidateBuffer } },
          { binding: 1, resource: { buffer: this.templateBuffer } },
          { binding: 2, resource: { buffer: scoreBuffer } },
          { binding: 3, resource: { buffer: paramsBuffer } },
        ],
      })
      const encoder = this.device.createCommandEncoder()
      const pass = encoder.beginComputePass()
      pass.setPipeline(this.pipeline)
      pass.setBindGroup(0, bindGroup)
      // 1候補につき1ワークグループを起動し、その中でテンプレ評価を並列化する。
      pass.dispatchWorkgroups(lineups.length)
      pass.end()
      encoder.copyBufferToBuffer(scoreBuffer, 0, readBuffer, 0, lineups.length * Float32Array.BYTES_PER_ELEMENT)
      this.device.queue.submit([encoder.finish()])

      await readBuffer.mapAsync(GPU_MAP_MODE_READ)
      return new Float32Array(readBuffer.getMappedRange().slice(0))
    } finally {
      if (readBuffer.mapState === 'mapped') readBuffer.unmap()
      candidateBuffer.destroy()
      scoreBuffer.destroy()
      readBuffer.destroy()
      paramsBuffer.destroy()
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.featureWorkers.destroy()
    this.templateBuffer.destroy()
    this.device.destroy()
  }
}
