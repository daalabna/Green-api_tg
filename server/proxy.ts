import https from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isGreenApiHost } from '../shared/api-host.ts'

const sendJson = (res: ServerResponse, status: number, payload: { message: string }) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

export const handleGreenApi = (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || ''
  if (!url.startsWith('/green-api/')) return false

  const host = String(req.headers['x-green-host'] || '')
  if (!isGreenApiHost(host)) {
    sendJson(res, 400, { message: 'Некорректный адрес API' })
    return true
  }

  const forward = (body: Buffer | null) => {
    const headers: Record<string, string | number> = { host }
    if (body?.length) {
      headers['Content-Type'] = 'application/json; charset=utf-8'
      headers['Content-Length'] = Buffer.byteLength(body)
    }

    const request = https.request(
      {
        hostname: host,
        path: url.slice('/green-api'.length),
        method: req.method,
        headers,
        timeout: 90000,
      },
      (response) => {
        const responseHeaders: Record<string, string> = {}
        const contentType = response.headers['content-type']
        if (typeof contentType === 'string') {
          responseHeaders['Content-Type'] = contentType
        }
        res.writeHead(response.statusCode || 502, responseHeaders)
        response.pipe(res)
      },
    )

    const abortUpstream = () => {
      if (!request.destroyed) request.destroy()
    }
    req.once('aborted', abortUpstream)
    res.once('close', () => {
      if (!res.writableEnded) abortUpstream()
    })

    request.on('timeout', () => {
      request.destroy(new Error('Превышено время ожидания GREEN-API'))
    })
    request.on('error', (error: Error) => {
      if (res.headersSent) return
      sendJson(res, 502, { message: error.message || 'GREEN-API недоступен' })
    })

    if (body?.length) request.write(body)
    request.end()
  }

  if (req.method === 'GET' || req.method === 'DELETE' || req.method === 'HEAD') {
    forward(null)
    return true
  }

  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => forward(Buffer.concat(chunks)))
  req.on('error', () => {
    if (!res.headersSent) sendJson(res, 400, { message: 'Не удалось прочитать запрос' })
  })
  return true
}
