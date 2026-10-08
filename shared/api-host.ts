const HOST_RE = /^(?:[a-z0-9-]+\.)?api\.(?:green-api|greenapi)\.com$/i

export const isGreenApiHost = (host: string) => HOST_RE.test(host)
