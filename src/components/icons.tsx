import { initials } from '../chat/chat.ts'

const AVATARS = [
  ['#ff48b6', '#ff8a35'],
  ['#ffc93d', '#ff832a'],
  ['#14e1d5', '#03c722'],
  ['#08d7f3', '#5398ff'],
  ['#bf97ff', '#526eff'],
] as const

const hash = (value: string) =>
  [...String(value || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0)

export const Avatar = ({ title, phone }: { title: string; phone: string }) => {
  const palette = AVATARS[hash(title || phone) % AVATARS.length]
  return (
    <span
      className="avatar"
      style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` }}
      aria-hidden="true"
    >
      {initials(title, phone)}
    </span>
  )
}

export const BubbleIcon = () => (
  <svg viewBox="0 0 48 48" width="28" height="28">
    <path
      fill="currentColor"
      d="M8 10.5A6.5 6.5 0 0 1 14.5 4h19A6.5 6.5 0 0 1 40 10.5v15A6.5 6.5 0 0 1 33.5 32H22l-8.2 6.2A1.5 1.5 0 0 1 11 37v-5.2A6.5 6.5 0 0 1 8 25.5v-15Z"
    />
  </svg>
)

export const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="currentColor" d="M3.2 11.4 20.2 3.2c.8-.4 1.7.4 1.4 1.3l-3.2 14.2c-.2.8-1.2 1.1-1.8.5l-4.2-4.1-2.4 2.4c-.6.6-1.6.2-1.6-.7v-3.2L3.4 12.8c-.9-.3-.9-1.5 0-1.4Z" />
  </svg>
)
