import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteNotification,
  getSettings,
  isTelegramInstance,
  needsHttpReceiving,
  receiveNotification,
  telegramInstanceError,
} from '../api/client.ts'
import { applyIncoming, formatTime, markRead } from '../chat/chat.ts'
import { ChatPane } from '../components/ChatPane.tsx'
import { Avatar, BubbleIcon } from '../components/icons.tsx'
import { Login } from '../components/Login.tsx'
import { NewChat } from '../components/NewChat.tsx'
import { activeKey, chatsKey, loadSession, readChats, SESSION_KEY } from '../storage/local.ts'
import type { Chat, ChatUpdater, Session } from '../types/types.ts'
import { wait } from '../lib/wait.ts'

interface Store {
  id: string | null
  chats: Chat[]
}

const App = () => {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [store, setStore] = useState<Store>({ id: null, chats: [] })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [banner, setBanner] = useState('')
  const [pollError, setPollError] = useState('')
  const [entryError, setEntryError] = useState('')
  const activeRef = useRef<string | null>(null)
  const sessionRef = useRef(session)

  activeRef.current = activeId
  sessionRef.current = session

  const updateChats = useCallback((updater: ChatUpdater) => {
    setStore((prev) => ({
      ...prev,
      id: sessionRef.current?.idInstance ?? prev.id,
      chats: updater(prev.chats),
    }))
  }, [])

  useEffect(() => {
    if (!session) {
      setStore({ id: null, chats: [] })
      setActiveId(null)
      return
    }
    const chats = readChats(session.idInstance)
    const savedActive = localStorage.getItem(activeKey(session.idInstance))
    const active = chats.some((chat) => chat.chatId === savedActive) ? savedActive : null
    setStore({ id: session.idInstance, chats: active ? markRead(chats, active) : chats })
    setActiveId(active)
  }, [session])

  useEffect(() => {
    if (!store.id) return
    try {
      localStorage.setItem(chatsKey(store.id), JSON.stringify(store.chats))
    } catch {
      // Переполнение хранилища браузера не должно останавливать чат.
    }
  }, [store])

  useEffect(() => {
    if (!session) return undefined
    const controller = new AbortController()
    let stopped = false

    ;(async () => {
      for (;;) {
        if (stopped) return
        try {
          const settings = await getSettings(session)
          if (stopped) return
          if (!isTelegramInstance(settings)) {
            localStorage.removeItem(SESSION_KEY)
            setEntryError(telegramInstanceError)
            setSession(null)
            return
          }
          setNeedsSetup(needsHttpReceiving(settings))
          setPollError('')
          break
        } catch (error) {
          if (stopped || controller.signal.aborted) return
          setPollError(error instanceof Error ? error.message : 'Не удалось проверить инстанс')
          try {
            await wait(3000, controller.signal)
          } catch {
            return
          }
        }
      }

      while (!stopped) {
        const started = Date.now()
        try {
          const notice = await receiveNotification(session, controller.signal)
          if (stopped) return
          setPollError('')
          if (notice?.receiptId != null) {
            if (notice.body) {
              updateChats((prev) =>
                applyIncoming(prev, notice.body, activeRef.current, notice.receiptId),
              )
            }
            try {
              await deleteNotification(session, notice.receiptId, controller.signal)
            } catch (error) {
              if (stopped || controller.signal.aborted) return
              if (error instanceof Error && error.name !== 'AbortError') {
                setPollError(error.message)
              }
              await wait(1000, controller.signal)
            }
          } else if (Date.now() - started < 800) {
            await wait(1000, controller.signal)
          }
        } catch (error) {
          if (stopped || controller.signal.aborted) return
          const message = error instanceof Error ? error.message : 'Не удалось получить сообщение'
          setPollError(message)
          if (/webhook/i.test(message)) setNeedsSetup(true)
          try {
            await wait(3000, controller.signal)
          } catch {
            return
          }
        }
      }
    })()

    return () => {
      stopped = true
      controller.abort()
    }
  }, [session, updateChats])

  const placeChat = (chat: Chat) => {
    const same = (item: Chat) =>
      item.chatId === chat.chatId || (chat.phone !== '' && item.phone === chat.phone)
    const existing = store.chats.find(same)
    if (existing) return existing.chatId
    updateChats((prev) => (prev.some(same) ? prev : [chat, ...prev]))
    return chat.chatId
  }

  const openChat = (chatId: string) => {
    setActiveId(chatId)
    if (session) localStorage.setItem(activeKey(session.idInstance), chatId)
    updateChats((prev) => markRead(prev, chatId))
  }

  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setNeedsSetup(false)
    setBanner('')
    setPollError('')
    setEntryError('')
  }

  if (!session) {
    return (
      <Login
        entryError={entryError}
        onDismissEntry={() => setEntryError('')}
        onSuccess={setSession}
      />
    )
  }

  const chats = store.chats
  const active = chats.find((chat) => chat.chatId === activeId) || null

  return (
    <main className={active ? 'app chat-open' : 'app'}>
      <aside className="sidebar">
        <header className="sidebar-head">
          <div>
            <p className="eyebrow">Telegram</p>
            <h1>Чаты</h1>
          </div>
          <button type="button" className="ghost" onClick={logout}>
            Выйти
          </button>
        </header>
        <NewChat session={session} chats={chats} onOpen={openChat} onCreate={placeChat} />
        <ul className="chat-list">
          {chats.length === 0 && <li className="empty-list">Чатов пока нет</li>}
          {chats.map((chat) => {
            const last = chat.messages.at(-1)
            return (
            <li key={chat.chatId}>
              <button
                type="button"
                className={chat.chatId === activeId ? 'chat-row active' : 'chat-row'}
                onClick={() => openChat(chat.chatId)}
              >
                <Avatar title={chat.title} phone={chat.phone} />
                <span className="chat-row-text">
                  <span className="chat-row-top">
                    <span className="name">{chat.title}</span>
                    {last && <time>{formatTime(last.time)}</time>}
                  </span>
                  <span className="preview">{last ? last.text : 'Нет сообщений'}</span>
                </span>
                {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
              </button>
            </li>
            )
          })}
        </ul>
      </aside>
      <section className="conversation">
        {active ? (
          <ChatPane
            key={active.chatId}
            chat={active}
            session={session}
            needsSetup={needsSetup}
            banner={banner}
            pollError={pollError}
            onBack={() => setActiveId(null)}
            onChats={updateChats}
            onSetupChange={setNeedsSetup}
            onBanner={setBanner}
          />
        ) : (
          <div className="placeholder">
            <div className="logo" aria-hidden="true">
              <BubbleIcon />
            </div>
            <h2>Выберите чат</h2>
            <p>Введите номер телефона и создайте новый чат, чтобы отправить текстовое сообщение.</p>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
