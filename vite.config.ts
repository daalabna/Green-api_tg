import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleGreenApi } from './server/proxy.ts'

const greenApiProxy = (): Plugin => {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!handleGreenApi(req as IncomingMessage, res as ServerResponse)) next()
  }

  return {
    name: 'green-api-proxy',
    configureServer: (server) => {
      server.middlewares.use(middleware)
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), greenApiProxy()],
  server: {
    port: 5173,
  },
})
