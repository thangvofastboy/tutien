// Contract cho $.state của plugin tutien (tự đầy đủ, không import từ ngoài file).
// Dạng Player khớp hooks/rules.ts; đổi một bên thì đổi bên kia.
export type Artifact = 'e' | 't' | 'd'
export type TutienPlayer = {
  realm: number
  exp: number
  pending: number
  cls: string
  gender: string
  artifacts: Artifact[]
  failedLast?: boolean
  trib?: { startedAt: number; deadline: number; required: number; earned: number }
}

declare module 'claude-code' {
  interface PluginState {
    tutien: {
      me: TutienPlayer | undefined
      effect: { kind: string; until: number } | null
      tick: number
      settingsTick: number
      wizard: { step: number; cls?: string; gender?: string; name?: string; persona?: string; display?: string; done?: boolean }
      wizardError: string | null
      typed: number
    }
  }
}
