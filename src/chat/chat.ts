import type { Chat, ChatMessage, IncomingBody, SenderData } from '../types/types.ts'

export const normalizePhone = (input: string) => {
  let digits = String(input || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`
  }
  if (digits.length < 11 || digits.length > 15) return ''
  return digits
}

export const formatPhone = (phone: string | number | undefined) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }
  return `+${digits}`
}

export const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

export const chatTitle = (username: string | undefined, phone: string | number | undefined) => {
  const name = String(username || '').trim()
  if (name) return name.startsWith('@') ? name : `@${name}`
  return formatPhone(phone)
}

export const initials = (title: string, phone: string) => {
  const letter = String(title || '').replace(/[^A-Za-zА-Яа-яЁё]/g, '').slice(0, 1)
  if (letter) return letter.toUpperCase()
  return String(phone || '').slice(-2) || '?'
}

export const makeChat = ({
  chatId,
  phone,
  title,
}: {
  chatId: string | number
  phone?: string | number
  title?: string
}): Chat => ({
  chatId: String(chatId),
  phone: String(phone || ''),
  title: title || formatPhone(phone) || String(chatId),
  createdAt: Date.now(),
  unread: 0,
  messages: [],
})

const activity = (chat: Chat) => {
  const last = chat.messages[chat.messages.length - 1]
  return last?.time || chat.createdAt || 0
}

const sortChats = (chats: Chat[]) => [...chats].sort((a, b) => activity(b) - activity(a))

export const markRead = (chats: Chat[], chatId: string) =>
  chats.map((chat) => (chat.chatId === chatId ? { ...chat, unread: 0 } : chat))

export const addMessage = (chats: Chat[], chatId: string, message: ChatMessage) =>
  sortChats(
    chats.map((chat) =>
      chat.chatId === chatId ? { ...chat, messages: [...chat.messages, message] } : chat,
    ),
  )

export const patchMessage = (
  chats: Chat[],
  chatId: string,
  messageId: string,
  patch: Partial<ChatMessage>,
) =>
  chats.map((chat) => {
    if (chat.chatId !== chatId) return chat
    return {
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === messageId ? { ...message, ...patch } : message,
      ),
    }
  })

const toMillis = (timestamp: number | undefined) => {
  const value = Number(timestamp)
  if (!value) return Date.now()
  return value < 1e12 ? value * 1000 : value
}

const sameChat = (chat: Chat, chatId: string, phone: string) => {
  if (chatId && chat.chatId === chatId) return true
  if (!phone) return false
  return chat.phone === phone || chat.chatId === phone || chat.chatId === `${phone}@c.us`
}

const preferTitle = (chat: Chat, sender: SenderData) => {
  const incomingName = sender.senderName || sender.chatName
  if (!incomingName) return chat.title
  if (!chat.title || chat.title === formatPhone(chat.phone)) return incomingName
  return chat.title
}

export const applyIncoming = (
  chats: Chat[],
  body: IncomingBody | null | undefined,
  activeId: string | null,
  receiptId?: number,
) => {
  if (!body || body.typeWebhook !== 'incomingMessageReceived') return chats
  if (body.messageData?.typeMessage !== 'textMessage') return chats

  const text = body.messageData?.textMessageData?.textMessage
  if (!text) return chats

  const sender = body.senderData || {}
  const chatId = sender.chatId != null ? String(sender.chatId) : ''
  const phone = sender.senderPhoneNumber ? String(sender.senderPhoneNumber) : ''
  const id = body.idMessage
    ? String(body.idMessage)
    : `${receiptId ?? ''}:${chatId}:${body.timestamp ?? ''}:${text}`
  const message: ChatMessage = {
    id,
    text,
    direction: 'in',
    time: toMillis(body.timestamp),
    status: 'sent',
  }

  const index = chats.findIndex((chat) => sameChat(chat, chatId, phone))
  if (index === -1) {
    const created = makeChat({
      chatId: chatId || phone || id,
      phone,
      title: sender.senderName || sender.chatName || formatPhone(phone) || 'Новый чат',
    })
    const chat: Chat = {
      ...created,
      unread: activeId && (activeId === created.chatId || activeId === phone) ? 0 : 1,
      messages: [message],
    }
    return sortChats([chat, ...chats])
  }

  const current = chats[index]
  if (current.messages.some((item) => item.id === id)) return chats

  const opened = current.chatId === activeId
  const next: Chat = {
    ...current,
    phone: current.phone || phone,
    title: preferTitle(current, sender),
    unread: opened ? 0 : (current.unread || 0) + 1,
    messages: [...current.messages, message],
  }
  return sortChats(chats.map((chat, itemIndex) => (itemIndex === index ? next : chat)))
}
