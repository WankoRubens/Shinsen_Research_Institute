/// <reference lib="webworker" />

import {
  buildAiGpuFeatureBatch,
  createAiGpuFeatureCatalog,
  type AiGpuFeatureCatalog,
} from '../lib/aiOptimizerGpuFeatures'
import type {
  AiGpuFeatureWorkerRequest,
  AiGpuFeatureWorkerResponse,
} from '../lib/aiOptimizerGpuFeatureWorkerTypes'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AiGpuFeatureWorkerRequest>) => void) | null
  postMessage: (message: AiGpuFeatureWorkerResponse, transfer?: Transferable[]) => void
}

let catalog: AiGpuFeatureCatalog | null = null

scope.onmessage = (event) => {
  const message = event.data
  try {
    if (message.type === 'init') {
      catalog = createAiGpuFeatureCatalog(message.heroes, message.skills, message.bingxue)
      scope.postMessage({ type: 'ready' })
      return
    }
    if (!catalog) throw new Error('GPU特徴量Workerが初期化されていません。')

    const features = buildAiGpuFeatureBatch(message.lineups, catalog)
    const buffer = features.buffer as ArrayBuffer
    // コピーを発生させず、作成した数値バッファの所有権をメイン側へ渡す。
    scope.postMessage(
      { type: 'result', taskId: message.taskId, features: buffer },
      [buffer],
    )
  } catch (error) {
    scope.postMessage({
      type: 'error',
      taskId: message.type === 'build' ? message.taskId : undefined,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
