import { useState, type SubmitEvent } from 'react'
import { checkAccount } from '../api/client.ts'
import { chatTitle, makeChat, normalizePhone } from '../chat/chat.ts'
import type { Chat, Session } from '../types/types.ts'

interface NewChatProps {
  session: Session
  chats: Chat[]
  onOpen: (chatId: string) => void
  onCreate: (chat: Chat) => string
}

export const NewChat = ({ session, chats, onOpen, onCreate }: NewChatProps) => {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setError('Введите номер в международном формате, например 79001234567.')
      return
    }

    const existing = chats.find((chat) => chat.phone === normalized)
    if (existing) {
      setPhone('')
      setError('')
      onOpen(existing.chatId)
      return
    }

    setLoading(true)
    setError('')
    try {
      const account = await checkAccount(session, normalized)
      if (!account?.exist || !account.chatId) {
        setError('На этом номере нет аккаунта Telegram.')
        return
      }
      const chat = makeChat({
        chatId: account.chatId,
        phone: String(account.phoneNumber || normalized),
        title: chatTitle(account.username, account.phoneNumber || normalized),
      })
      onOpen(onCreate(chat))
      setPhone('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось создать чат')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="new-chat" onSubmit={submit}>
      <input
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Номер телефона"
        aria-label="Номер телефона"
        inputMode="tel"
      />
      <button type="submit" className="primary" disabled={loading}>
        {loading ? 'Проверка...' : 'Создать чат'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </form>
  )
}
