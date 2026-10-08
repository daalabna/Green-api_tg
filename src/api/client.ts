import type {
  AccountCheck,
  IncomingBody,
  InstanceSettings,
  Notification,
  SenderData,
  Session,
} from '../types/types.ts'

interface RequestOptions {
  body?: unknown
  query?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
}

const apiHost = (idInstance: string) => {
  if (!/^\d{4,}$/.test(idInstance)) {
    throw new Error('Введите корректный idInstance.')
  }
  return `${idInstance.slice(0, 4)}.api.green-api.com`
}

export const stateError = (state: string | undefined) => {
  if (state === 'notAuthorized') {
    return 'Инстанс не авторизован. Подключите Telegram в консоли GREEN-API.'
  }
  if (state === 'starting') return 'Инстанс запускается. Подождите минуту и войдите снова.'
  if (state === 'blocked') return 'Инстанс заблокирован.'
  if (state === 'suspended') return 'На аккаунт Telegram действует временное ограничение.'
  if (state === 'pendingCode') return 'Введите код авторизации в консоли GREEN-API.'
  if (state === 'pendingPassword') return 'Для входа нужен пароль двухфакторной защиты Telegram.'
  return 'Не удалось подтвердить авторизацию инстанса.'
}

export const telegramInstanceError =
  'Нужен инстанс Telegram. Инстанс MAX или WhatsApp не подходит.'

export const isTelegramInstance = (settings: InstanceSettings | null) =>
  settings?.typeInstance === 'telegram'

export const needsHttpReceiving = (settings: InstanceSettings | null) => {
  if (!settings) return true
  const webhook = settings.webhookUrl.trim()
  if (webhook) return true
  return settings.incomingWebhook !== 'yes' && settings.incomingWebhook !== true
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseBody = (text: string): unknown => {
  const trimmed = text.trim()
  if (!trimmed || trimmed === 'null') return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return trimmed
  }
}

const errorText = (data: unknown, fallback: string) => {
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (isRecord(data) && typeof data.message === 'string' && data.message) return data.message
  if (isRecord(data) && typeof data.error === 'string' && data.error) return data.error
  return fallback
}

const apiRequest = async (
  session: Session,
  method: string,
  endpoint: string,
  options: RequestOptions = {},
) => {
  const { body, query, signal, timeoutMs = 30000 } = options
  const params = query ? `?${new URLSearchParams(query)}` : ''
  const url = `/green-api/waInstance${encodeURIComponent(session.idInstance)}/${endpoint}/${encodeURIComponent(session.apiTokenInstance)}${params}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Green-Host': apiHost(session.idInstance),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    const data = parseBody(text)
    if (!response.ok) {
      const fallback =
        response.status === 401
          ? 'Неверный idInstance или apiTokenInstance.'
          : `Ошибка ${response.status}`
      throw new Error(errorText(data, fallback))
    }
    return data
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    if (error instanceof TypeError) {
      throw new Error('Нет соединения с приложением. Запустите его через npm run dev.')
    }
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

const parseState = (data: unknown) => {
  if (typeof data === 'string') return data
  if (!isRecord(data)) return undefined
  return typeof data.stateInstance === 'string' ? data.stateInstance : undefined
}

const parseSettings = (data: unknown): InstanceSettings | null => {
  if (!isRecord(data)) return null
  const settings: InstanceSettings = {
    webhookUrl: typeof data.webhookUrl === 'string' ? data.webhookUrl : '',
  }
  if (data.incomingWebhook === 'yes' || data.incomingWebhook === 'no' || typeof data.incomingWebhook === 'boolean') {
    settings.incomingWebhook = data.incomingWebhook
  }
  if (data.typeInstance === 'telegram' || data.typeInstance === 'whatsapp' || data.typeInstance === 'v3') {
    settings.typeInstance = data.typeInstance
  }
  return settings
}

const parseAccount = (data: unknown): AccountCheck | null => {
  if (!isRecord(data)) return null
  const account: AccountCheck = {}
  if (typeof data.exist === 'boolean') account.exist = data.exist
  if (typeof data.chatId === 'string' || typeof data.chatId === 'number') account.chatId = data.chatId
  if (typeof data.username === 'string') account.username = data.username
  if (typeof data.phoneNumber === 'string' || typeof data.phoneNumber === 'number') {
    account.phoneNumber = data.phoneNumber
  }
  return account
}

const parseSender = (data: Record<string, unknown>): SenderData => {
  const sender: SenderData = {}
  if (typeof data.chatId === 'string' || typeof data.chatId === 'number') sender.chatId = data.chatId
  if (typeof data.senderPhoneNumber === 'number') sender.senderPhoneNumber = data.senderPhoneNumber
  if (typeof data.senderName === 'string') sender.senderName = data.senderName
  if (typeof data.chatName === 'string') sender.chatName = data.chatName
  return sender
}

const parseMessageData = (data: Record<string, unknown>): IncomingBody['messageData'] => {
  const messageData: NonNullable<IncomingBody['messageData']> = {}
  if (typeof data.typeMessage === 'string') messageData.typeMessage = data.typeMessage
  if (isRecord(data.textMessageData) && typeof data.textMessageData.textMessage === 'string') {
    messageData.textMessageData = { textMessage: data.textMessageData.textMessage }
  }
  return messageData
}

const parseIncomingBody = (data: unknown): IncomingBody | null => {
  if (!isRecord(data)) return null
  const body: IncomingBody = {}
  if (typeof data.typeWebhook === 'string') body.typeWebhook = data.typeWebhook
  if (typeof data.timestamp === 'number') body.timestamp = data.timestamp
  if (typeof data.idMessage === 'string' || typeof data.idMessage === 'number') {
    body.idMessage = String(data.idMessage)
  }
  if (isRecord(data.senderData)) body.senderData = parseSender(data.senderData)
  if (isRecord(data.messageData)) body.messageData = parseMessageData(data.messageData)
  return body
}

const receiptIdOf = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return undefined
  const id = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(id) && id > 0 ? id : undefined
}

const parseNotification = (data: unknown): Notification | null => {
  if (data == null || !isRecord(data)) return null
  const receiptId = receiptIdOf(data.receiptId)
  if (receiptId === undefined) return null
  return {
    receiptId,
    body: parseIncomingBody(data.body),
  }
}

export const getStateInstance = async (session: Session) =>
  parseState(await apiRequest(session, 'GET', 'getStateInstance'))

export const getSettings = async (session: Session) =>
  parseSettings(await apiRequest(session, 'GET', 'getSettings'))

export const enableIncoming = async (session: Session) => {
  const data = await apiRequest(session, 'POST', 'setSettings', {
    body: {
      webhookUrl: '',
      incomingWebhook: 'yes',
    },
  })
  if (!isRecord(data) || data.saveSettings !== true) {
    throw new Error('Не удалось сохранить настройки')
  }
}

export const checkAccount = async (session: Session, phoneNumber: string) =>
  parseAccount(await apiRequest(session, 'POST', 'checkAccount', {
    body: { phoneNumber: Number(phoneNumber) },
  }))

export const sendTextMessage = async (session: Session, chatId: string, message: string) => {
  await apiRequest(session, 'POST', 'sendMessage', {
    body: { chatId, message },
  })
}

export const receiveNotification = async (session: Session, signal: AbortSignal) => {
  try {
    return parseNotification(await apiRequest(session, 'GET', 'receiveNotification', {
      query: { receiveTimeout: '20' },
      signal,
      timeoutMs: 50000,
    }))
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof Error && error.name === 'AbortError') return null
    throw error
  }
}

export const deleteNotification = (session: Session, receiptId: number, signal: AbortSignal) =>
  apiRequest(session, 'DELETE', `deleteNotification/${receiptId}`, { signal })
