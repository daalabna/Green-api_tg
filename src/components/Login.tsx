import { useState, type SubmitEvent } from 'react'
import { getSettings, getStateInstance, isTelegramInstance, stateError, telegramInstanceError } from '../api/client.ts'
import { BubbleIcon } from './icons.tsx'
import { SESSION_KEY } from '../storage/local.ts'
import type { Session } from '../types/types.ts'

interface LoginProps {
  entryError?: string
  onDismissEntry: () => void
  onSuccess: (session: Session) => void
}

export const Login = ({ entryError, onDismissEntry, onSuccess }: LoginProps) => {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!idInstance) {
      setError('Введите idInstance.')
      return
    }
    if (!apiTokenInstance.trim()) {
      setError('Введите apiTokenInstance.')
      return
    }

    setLoading(true)
    setError('')
    onDismissEntry()
    try {
      const nextSession: Session = {
        idInstance,
        apiTokenInstance: apiTokenInstance.trim(),
      }
      const settings = await getSettings(nextSession)
      if (!isTelegramInstance(settings)) {
        throw new Error(telegramInstanceError)
      }
      const stateName = await getStateInstance(nextSession)
      if (stateName !== 'authorized') {
        throw new Error(stateError(stateName))
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
      onSuccess(nextSession)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось войти')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="logo" aria-hidden="true">
          <BubbleIcon />
        </div>
        <h1>Чат Telegram</h1>
        <p className="lead">Текстовые сообщения через GREEN-API. Данные инстанса берутся из консоли.</p>
        <label>
          idInstance
          <input
            inputMode="numeric"
            autoComplete="off"
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value.replace(/\D/g, ''))}
            placeholder="4100000000"
          />
        </label>
        <label>
          apiTokenInstance
          <input
            type="password"
            autoComplete="off"
            value={apiTokenInstance}
            onChange={(event) => setApiTokenInstance(event.target.value)}
            placeholder="Токен из консоли"
          />
        </label>
        {(error || entryError) && <p className="form-error">{error || entryError}</p>}
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Вход...' : 'Войти'}
        </button>
        <p className="hint">Ключ хранится только в этом браузере.</p>
      </form>
    </div>
  )
}
