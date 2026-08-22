import type { Hero, Skill } from '../composables/useData'
import type {
  AiWorkerEvaluateMessage,
  AiWorkerEvaluationResult,
  AiWorkerInitMessage,
  AiWorkerLineupSnapshot,
  AiWorkerResponse,
  AiWorkerTemplate,
} from './aiOptimizerWorkerTypes'

interface PendingTask {
  message: AiWorkerEvaluateMessage
  resolve: (result: AiWorkerEvaluationResult) => void
  reject: (error: Error) => void
}

interface WorkerSlot {
  worker: Worker
  ready: boolean
  activeTask: PendingTask | null
}

// スマホは発熱とメモリを抑え、PCはUI用に1論理コア残す。
export const recommendedAiWorkerCount = (): number => {
  if (typeof navigator === 'undefined') return 1
  const cores = Math.max(1, navigator.hardwareConcurrency || 2)
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return mobile ? Math.min(2, cores) : Math.min(6, Math.max(2, cores - 1))
}

export class AiOptimizerWorkerPool {
  readonly size: number
  private readonly slots: WorkerSlot[] = []
  private readonly queue: PendingTask[] = []
  private taskId = 0
  private destroyed = false

  constructor(
    size: number,
    heroes: Hero[],
    skills: Skill[],
    templates: AiWorkerTemplate[],
  ) {
    this.size = Math.max(1, Math.floor(size))
    // 初期データだけは一度JSON化し、Vue ProxyをWorkerへ渡さない。
    const initMessage = JSON.parse(JSON.stringify({
      type: 'init',
      heroes,
      skills,
      templates,
    })) as AiWorkerInitMessage

    for (let index = 0; index < this.size; index += 1) {
      const worker = new Worker(new URL('../workers/aiOptimizer.worker.ts', import.meta.url), { type: 'module' })
      const slot: WorkerSlot = { worker, ready: false, activeTask: null }
      worker.onmessage = (event: MessageEvent<AiWorkerResponse>) => this.handleMessage(slot, event.data)
      worker.onerror = (event) => this.handleWorkerFailure(slot, new Error(event.message || 'AI探索Workerでエラーが発生しました。'))
      worker.postMessage(initMessage)
      this.slots.push(slot)
    }
  }

  evaluate(
    lineup: AiWorkerLineupSnapshot,
    runs: number,
    seed: string,
    templateIds: string[],
  ): Promise<AiWorkerEvaluationResult> {
    if (this.destroyed) return Promise.reject(new Error('AI探索Workerは終了しています。'))
    this.taskId += 1
    const message: AiWorkerEvaluateMessage = {
      type: 'evaluate',
      taskId: this.taskId,
      lineup,
      runs,
      seed,
      templateIds,
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ message, resolve, reject })
      this.dispatch()
    })
  }

  destroy(): void {
    this.destroyed = true
    this.slots.forEach((slot) => {
      slot.activeTask?.reject(new Error('AI探索を終了しました。'))
      slot.worker.terminate()
    })
    this.queue.splice(0).forEach((task) => task.reject(new Error('AI探索を終了しました。')))
    this.slots.length = 0
  }

  private handleMessage(slot: WorkerSlot, response: AiWorkerResponse): void {
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
    if (response.type === 'result') task.resolve(response.result)
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
