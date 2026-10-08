export interface Session {
  idInstance: string
  apiTokenInstance: string
}

export type MessageDirection = 'in' | 'out'
export type MessageStatus = 'sending' | 'sent' | 'error'

export interface ChatMessage {
  id: string
  text: string
  direction: MessageDirection
  time: number
  status: MessageStatus
  error?: string
}

export interface Chat {
  chatId: string
  phone: string
  title: string
  createdAt: number
  unread: number
  messages: ChatMessage[]
}

export type ChatUpdater = (chats: Chat[]) => Chat[]

export type InstanceKind = 'telegram' | 'whatsapp' | 'v3'

export interface InstanceSettings {
  webhookUrl: string
  incomingWebhook?: 'yes' | 'no' | boolean
  typeInstance?: InstanceKind
}

export interface AccountCheck {
  exist?: boolean
  chatId?: string | number
  username?: string
  phoneNumber?: string | number
}

export interface SenderData {
  chatId?: string | number
  senderPhoneNumber?: number
  senderName?: string
  chatName?: string
}

export interface IncomingBody {
  typeWebhook?: string
  timestamp?: number
  idMessage?: string
  senderData?: SenderData
  messageData?: {
    typeMessage?: string
    textMessageData?: {
      textMessage?: string
    }
  }
}

export interface Notification {
  receiptId?: number
  body?: IncomingBody | null
}
