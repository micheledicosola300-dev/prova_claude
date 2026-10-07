export type Job = {
  id: string
  tool: string
  at: number
  status: 'running' | 'done' | 'failed'
}

declare module 'claude-code' {
  interface PluginState {
    'studio-ai': { jobs: Job[] }
  }
}
