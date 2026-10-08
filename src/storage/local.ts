import type { Chat, ChatMessage, Session } from '../types/types.ts'

export const SESSION_KEY = 'green-telegram-session'

export const activeKey = (idInstance: string) => `green-telegram-active:${idInstance}`

export const chatsKey = (idInstance: string) => `green-telegram-chats:${idInstance}`

const isSession = (value: unknown): value is Session => {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<Session>
  return (
    typeof session.idInstance === 'string' &&
    session.idInstance !== '' &&
    typeof session.apiTokenInstance === 'string' &&
    session.apiTokenInstance !== ''
  )
}

export const loadSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSession(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

const isMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return (
    typeof message.id === 'string' &&
    typeof message.text === 'string' &&
    (message.direction === 'in' || message.direction === 'out') &&
    typeof message.time === 'number' &&
    Number.isFinite(message.time) &&
    (message.status === 'sending' || message.status === 'sent' || message.status === 'error') &&
    (message.error === undefined || typeof message.error === 'string')
  )
}

const readMessage = (value: unknown): ChatMessage | null => {
  if (!isMessage(value)) return null
  const message: ChatMessage = {
    id: value.id,
    text: value.text,
    direction: value.direction,
    time: value.time,
    status: value.status,
  }
  if (typeof value.error === 'string') message.error = value.error
  return message
}

const readChat = (value: unknown): Chat | null => {
  if (!value || typeof value !== 'object') return null
  const chat = value as Record<string, unknown>
  if (typeof chat.chatId !== 'string' || chat.chatId === '') return null
  const messages = Array.isArray(chat.messages)
    ? chat.messages.flatMap((item) => {
        const message = readMessage(item)
        return message ? [message] : []
      })
    : []
  return {
    chatId: chat.chatId,
    phone: typeof chat.phone === 'string' ? chat.phone : '',
    title: typeof chat.title === 'string' && chat.title ? chat.title : chat.chatId,
    createdAt: typeof chat.createdAt === 'number' && Number.isFinite(chat.createdAt) ? chat.createdAt : 0,
    unread: typeof chat.unread === 'number' && Number.isFinite(chat.unread) ? chat.unread : 0,
    messages,
  }
}

export const readChats = (idInstance: string): Chat[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(chatsKey(idInstance)) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      const chat = readChat(item)
      return chat ? [chat] : []
    })
  } catch {
    return []
  }
}
