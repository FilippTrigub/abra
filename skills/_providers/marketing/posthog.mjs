// PostHog provider

const API_KEY = process.env.POSTHOG_API_KEY
const PROJECT_API_KEY = process.env.POSTHOG_PROJECT_API_KEY
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const APP_HOST = (process.env.POSTHOG_APP_HOST || process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '')
const INGEST_HOST = (process.env.POSTHOG_INGEST_HOST || process.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '')

function hasQueryCredentials() {
  return Boolean(API_KEY && PROJECT_ID)
}

function hasProjectApiKey() {
  return Boolean(PROJECT_API_KEY)
}

function checkQueryKeys() {
  if (!API_KEY || !PROJECT_ID) {
    throw new Error('POSTHOG_API_KEY and POSTHOG_PROJECT_ID environment variables required')
  }
}

function checkProjectApiKey() {
  if (!PROJECT_API_KEY) {
    throw new Error('POSTHOG_PROJECT_API_KEY environment variable required')
  }
}

async function parseResponse(res) {
  const text = await res.text()
  if (!text) return { status: res.status, success: res.ok }
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

async function api(method, path, body) {
  checkQueryKeys()
  const res = await fetch(`${APP_HOST}/api/projects/${PROJECT_ID}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return parseResponse(res)
}

async function publicPost(path, body) {
  checkProjectApiKey()
  const res = await fetch(`${INGEST_HOST}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return parseResponse(res)
}

export const PostHog = {
  hasQueryCredentials,
  hasProjectApiKey,

  /**
   * Run a PostHog Query API request.
   * @param {object} query - PostHog query object, e.g. { kind: 'HogQLQuery', query: 'SELECT ...' }
   */
  async query(query) {
    if (!query || typeof query !== 'object') throw new Error('query object required')
    return api('POST', '/query/', { query })
  },

  /**
   * Convenience wrapper for HogQL.
   * @param {string} sql - HogQL query string
   * @param {object} options - Optional query settings
   */
  async hogql(sql, options = {}) {
    if (!sql) throw new Error('sql required')
    return this.query({ kind: 'HogQLQuery', query: sql, ...options })
  },

  async listInsights(options = {}) {
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', options.limit)
    if (options.offset) params.set('offset', options.offset)
    const qs = params.toString()
    return api('GET', `/insights/${qs ? '?' + qs : ''}`)
  },

  async getPersonByDistinctId(distinctId) {
    if (!distinctId) throw new Error('distinctId required')
    return api('GET', `/persons/?distinct_id=${encodeURIComponent(distinctId)}`)
  },

  async listSessionRecordings(options = {}) {
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', options.limit)
    if (options.offset) params.set('offset', options.offset)
    const qs = params.toString()
    return api('GET', `/session_recordings/${qs ? '?' + qs : ''}`)
  },

  async listFeatureFlags(options = {}) {
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', options.limit)
    if (options.offset) params.set('offset', options.offset)
    const qs = params.toString()
    return api('GET', `/feature_flags/${qs ? '?' + qs : ''}`)
  },

  async listExperiments(options = {}) {
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', options.limit)
    if (options.offset) params.set('offset', options.offset)
    const qs = params.toString()
    return api('GET', `/experiments/${qs ? '?' + qs : ''}`)
  },

  async captureEvent(distinctId, event, properties = {}) {
    if (!distinctId) throw new Error('distinctId required')
    if (!event) throw new Error('event required')
    return publicPost('/i/v0/e/', {
      api_key: PROJECT_API_KEY,
      distinct_id: distinctId,
      event,
      properties,
    })
  },

  async batchCapture(events) {
    if (!Array.isArray(events)) throw new Error('events must be an array')
    return publicPost('/batch/', {
      api_key: PROJECT_API_KEY,
      batch: events,
    })
  },

  async evaluateFlags(distinctId, options = {}) {
    if (!distinctId) throw new Error('distinctId required')
    return publicPost('/flags?v=2', {
      token: PROJECT_API_KEY,
      distinct_id: distinctId,
      ...options,
    })
  },
}
