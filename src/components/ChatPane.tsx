import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { enableIncoming, sendTextMessage } from '../api/client.ts'
import { addMessage, formatPhone, formatTime, patchMessage } from '../chat/chat.ts'
import { Avatar, SendIcon } from './icons.tsx'
import { activeKey } from '../storage/local.ts'
import type { Chat, ChatUpdater, Session } from '../types/types.ts'

interface ChatPaneProps {
  chat: Chat
  session: Session
  needsSetup: boolean
  banner: string
  pollError: string
  onBack: () => void
  onChats: (updater: ChatUpdater) => void
  onSetupChange: (value: boolean) => void
  onBanner: (value: string) => void
}

export const ChatPane = ({
  chat,
  session,
  needsSetup,
  banner,
  pollError,
  onBack,
  onChats,
  onSetupChange,
  onBanner,
}: ChatPaneProps) => {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [setupBusy, setSetupBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.chatId, chat.messages.length])

  const submit = async (event?: SubmitEvent) => {
    event?.preventDefault()
    const message = text.trim()
    if (!message || sending) return
    if (message.length > 4096) return

    const localId = crypto.randomUUID()
    setText('')
    setSending(true)
    onChats((prev) =>
      addMessage(prev, chat.chatId, {
        id: localId,
        text: message,
        direction: 'out',
        time: Date.now(),
        status: 'sending',
      }),
    )

    try {
      await sendTextMessage(session, chat.chatId, message)
      onChats((prev) =>
        patchMessage(prev, chat.chatId, localId, {
          status: 'sent',
        }),
      )
    } catch (reason) {
      onChats((prev) =>
        patchMessage(prev, chat.chatId, localId, {
          status: 'error',
          error: reason instanceof Error ? reason.message : 'Не отправлено',
        }),
      )
    } finally {
      setSending(false)
    }
  }

  const turnOnReceiving = async () => {
    setSetupBusy(true)
    onBanner('')
    try {
      await enableIncoming(session)
      onSetupChange(false)
      onBanner('Настройки сохранены. Если инстанс перезапустился, подождите пару минут.')
    } catch (reason) {
      onBanner(reason instanceof Error ? reason.message : 'Не удалось сохранить настройки')
    } finally {
      setSetupBusy(false)
    }
  }

  return (
    <>
      <header className="chat-head">
        <button
          type="button"
          className="back"
          onClick={() => {
            localStorage.removeItem(activeKey(session.idInstance))
            onBack()
          }}
          aria-label="К списку чатов"
        >
          ←
        </button>
        <Avatar title={chat.title} phone={chat.phone} />
        <div>
          <h2>{chat.title}</h2>
          <p>{formatPhone(chat.phone) || 'Личный чат'}</p>
        </div>
      </header>
      {(needsSetup || banner || pollError) && (
        <div className="notice">
          {needsSetup && (
            <p>
              Чтобы ответы появлялись в чате, включите получение уведомлений по HTTP API. Инстанс
              перезапустится, настройки применятся в течение нескольких минут.
            </p>
          )}
          {banner && <p>{banner}</p>}
          {pollError && !needsSetup && <p>{pollError}</p>}
          {needsSetup && (
            <button type="button" className="primary" onClick={turnOnReceiving} disabled={setupBusy}>
              {setupBusy ? 'Сохранение...' : 'Включить получение'}
            </button>
          )}
        </div>
      )}
      <div className="messages">
        {chat.messages.length === 0 && <p className="thread-empty">Напишите первое сообщение</p>}
        {chat.messages.map((message) => (
          <article key={message.id} className={`bubble ${message.direction}`}>
            <p>{message.text}</p>
            <span className="meta">
              <time>{formatTime(message.time)}</time>
              {message.direction === 'out' && message.status === 'sent' && <span>✓</span>}
              {message.status === 'sending' && <span>...</span>}
              {message.status === 'error' && <span>{message.error || 'не отправлено'}</span>}
            </span>
          </article>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea
          rows={1}
          value={text}
          placeholder="Сообщение"
          aria-label="Сообщение"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <button type="submit" className="send" disabled={sending || !text.trim() || text.trim().length > 4096} aria-label="Отправить">
          <SendIcon />
        </button>
      </form>
      {text.trim().length > 4096 && <p className="limit">Максимум 4096 символов</p>}
    </>
  )
}
