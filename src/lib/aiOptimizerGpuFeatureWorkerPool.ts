import type { BingxueOption, Hero, Skill } from '../composables/useData'
import type { AiWorkerLineupSnapshot } from './aiOptimizerWorkerTypes'
import type {
  AiGpuFeatureWorkerBuildMessage,
  AiGpuFeatureWorkerInitMessage,
  AiGpuFeatureWorkerResponse,
} from './aiOptimizerGpuFeatureWorkerTypes'

interface PendingTask {
  message: AiGpuFeatureWorkerBuildMessage
  resolve: (features: Float32Array) => void
  reject: (error: Error) => void
}

interface WorkerSlot {
  worker: Worker
  ready: boolean
  activeTask: PendingTask | null
}

const recommendedFeatureWorkerCount = (): number => {
  if (typeof navigator === 'undefined') return 1
  const cores = Math.max(1, navigator.hardwareConcurrency || 2)
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return mobile ? 1 : Math.min(4, Math.max(2, Math.floor(cores / 2)))
}

export class AiOptimizerGpuFeatureWorkerPool {
  readonly size: number
  private readonly slots: WorkerSlot[] = []
  private readonly queue: PendingTask[] = []
  private taskId = 0
  private destroyed = false

  constructor(
    heroes: Hero[],
    skills: Skill[],
    bingxue: Record<string, BingxueOption>,
  ) {
    this.size = recommendedFeatureWorkerCount()
    const initMessage = JSON.parse(JSON.stringify({
      type: 'init',
      heroes,
      skills,
      bingxue,
    })) as AiGpuFeatureWorkerInitMessage

    for (let index = 0; index < this.size; index += 1) {
      const worker = new Worker(new URL('../workers/aiOptimizerGpuFeature.worker.ts', import.meta.url), { type: 'module' })
      const slot: WorkerSlot = { worker, ready: false, activeTask: null }
      worker.onmessage = (event: MessageEvent<AiGpuFeatureWorkerResponse>) => this.handleMessage(slot, event.data)
      worker.onerror = (event) => this.handleWorkerFailure(slot, new Error(event.message || 'GPU特徴量Workerでエラーが発生しました。'))
      worker.postMessage(initMessage)
      this.slots.push(slot)
    }
  }

  build(lineups: AiWorkerLineupSnapshot[]): Promise<Float32Array> {
    if (this.destroyed) return Promise.reject(new Error('GPU特徴量Workerは終了しています。'))
    this.taskId += 1
    const message: AiGpuFeatureWorkerBuildMessage = {
      type: 'build',
      taskId: this.taskId,
      lineups,
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ message, resolve, reject })
      this.dispatch()
    })
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.slots.forEach((slot) => {
      slot.activeTask?.reject(new Error('GPU特徴量生成を終了しました。'))
      slot.worker.terminate()
    })
    this.queue.splice(0).forEach((task) => task.reject(new Error('GPU特徴量生成を終了しました。')))
    this.slots.length = 0
  }

  private handleMessage(slot: WorkerSlot, response: AiGpuFeatureWorkerResponse): void {
    if (response.type === 'ready') {
      slot.ready = true
      this.dispatch()
      return
    }
    const task = slot.activeTask
    if (!task) {
      if (response.type === 'error') this.handleWorkerFailure(slot, new Error(response.message))
      return
    }
    slot.activeTask = null
    if (response.type === 'result') task.resolve(new Float32Array(response.features))
    else task.reject(new Error(response.message))
    this.dispatch()
  }

  private handleWorkerFailure(slot: WorkerSlot, error: Error): void {
    slot.activeTask?.reject(error)
    slot.activeTask = null
    slot.worker.terminate()
    const index = this.slots.indexOf(slot)
    if (index >= 0) this.slots.splice(index, 1)
    if (this.slots.length === 0) {
      this.queue.splice(0).forEach((task) => task.reject(error))
      return
    }
    this.dispatch()
  }

  private dispatch(): void {
    if (this.destroyed) return
    for (const slot of this.slots) {
      if (!slot.ready || slot.activeTask || this.queue.length === 0) continue
      const task = this.queue.shift()
      if (!task) return
      slot.activeTask = task
      slot.worker.postMessage(task.message)
    }
  }
}
