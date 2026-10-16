// Contract cho $.state của plugin tutien (tự đầy đủ, không import từ ngoài file).
// Dạng Player khớp hooks/rules.ts; đổi một bên thì đổi bên kia.
export type Artifact = 'e' | 't' | 'd' | 'E' | 'T' | 'D'
export type TutienPlayer = {
  realm: number
  exp: number
  pending: number
  cls: string
  gender: string
  artifacts: Artifact[]
  failedLast?: boolean
  lastPenaltyAt?: number
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
      info: {
        quest: number; bicanh: string | null; tamma: number | null; tong: string | null
        streak?: number; linhCan?: { name: string; icon: string } | null; cpPoints?: number
        kyNgo?: { title: string; desc: string; a: string; b: string } | null
      } | null
      board: { rank: number; name: string; cls: string; realm: number; score: number }[]
      quickOut: { title: string; text: string; card?: string } | null
    }
  }
}
