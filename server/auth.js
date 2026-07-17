import crypto from 'node:crypto'

const COOKIE_NAME = 'balyaoko_admin'
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function secret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    'dev-insecure-change-me'
  )
}

/**
 * @param {object} payload
 * @returns {string}
 */
export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

/**
 * @param {string} token
 * @returns {object | null}
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.exp || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export function createSessionToken() {
  return signToken({ role: 'admin', exp: Date.now() + MAX_AGE_MS })
}

/**
 * @param {import('express').Request} req
 * @returns {boolean}
 */
export function isAuthenticated(req) {
  const token = req.cookies?.[COOKIE_NAME]
  return Boolean(verifyToken(token))
}

/**
 * @param {import('express').Response} res
 * @param {string} token
 */
export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  })
}

/** @param {import('express').Response} res */
export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

export { COOKIE_NAME }

/**
 * Constant-time password compare.
 * @param {string} provided
 * @param {string} expected
 */
export function passwordsMatch(provided, expected) {
  // Trim both sides so .env CRLF / accidental spaces don't reject valid logins.
  const a = Buffer.from(String(provided ?? '').trim(), 'utf8')
  const b = Buffer.from(String(expected ?? '').trim(), 'utf8')
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a)
    return false
  }
  return crypto.timingSafeEqual(a, b)
}
