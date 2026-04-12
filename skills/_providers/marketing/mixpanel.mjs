// Mixpanel CLI wrapper
// Wraps marketingskills/tools/clis/mixpanel.js functionality

const TOKEN = process.env.MIXPANEL_TOKEN
const API_KEY = process.env.MIXPANEL_API_KEY
const SECRET = process.env.MIXPANEL_SECRET
const INGESTION_URL = 'https://api.mixpanel.com'
const QUERY_URL = 'https://mixpanel.com/api/2.0'
const EXPORT_URL = 'https://data.mixpanel.com/api/2.0'

function checkKeys() {
  if (!TOKEN && !API_KEY) {
    throw new Error('MIXPANEL_TOKEN (for ingestion) or MIXPANEL_API_KEY + MIXPANEL_SECRET (for query/export) environment variables required')
  }
}

async function ingestApi(method, path, body) {
  checkKeys()
  const headers = { 'Content-Type': 'application/json' }
  const res = await fetch(`${INGESTION_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

async function queryApi(method, baseUrl, path, params) {
  if (!API_KEY || !SECRET) {
    throw new Error('MIXPANEL_API_KEY and MIXPANEL_SECRET required for query/export operations')
  }
  const auth = Buffer.from(`${API_KEY}:${SECRET}`).toString('base64')
  const url = params ? `${baseUrl}${path}?${params}` : `${baseUrl}${path}`
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  }
  const res = await fetch(url, {
    method,
    headers,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

async function queryApiPost(path, body) {
  if (!API_KEY || !SECRET) {
    throw new Error('MIXPANEL_API_KEY and MIXPANEL_SECRET required for query/export operations')
  }
  const auth = Buffer.from(`${API_KEY}:${SECRET}`).toString('base64')
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  }
  const res = await fetch(`${QUERY_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const Mixpanel = {
  /**
   * Track an event
   * @param {string} event - Event name
   * @param {string} distinctId - User distinct ID
   * @param {object} properties - Event properties
   * @param {object} options - Additional options (dryRun)
   */
  async trackEvent(event, distinctId, properties = {}, options = {}) {
    checkKeys()
    if (!TOKEN) throw new Error('MIXPANEL_TOKEN required for tracking')
    const props = { ...properties, token: TOKEN, distinct_id: distinctId }
    return ingestApi('POST', '/track', [{ event, properties: props }])
  },

  /**
   * Set user profile properties
   * @param {string} distinctId - User distinct ID
   * @param {object} properties - Profile properties to set
   * @param {object} options - Additional options (dryRun)
   */
  async setProfile(distinctId, properties = {}, options = {}) {
    checkKeys()
    if (!TOKEN) throw new Error('MIXPANEL_TOKEN required for profiles')
    return ingestApi('POST', '/engage', [{
      $token: TOKEN,
      $distinct_id: distinctId,
      $set: properties,
    }])
  },

  /**
   * Query event insights
   * @param {string} projectId - Mixpanel project ID
   * @param {string} event - Event name (default: 'all')
   * @param {object} dateRange - { fromDate, toDate } in YYYY-MM-DD format
   * @param {object} options - Additional options (dryRun)
   */
  async queryEvents(projectId, event = 'all', dateRange = {}, options = {}) {
    checkKeys()
    const body = {
      project_id: parseInt(projectId),
      bookmark_id: null,
      params: {
        events: [{ event: event || 'all' }],
        time_range: {
          from_date: dateRange.fromDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
          to_date: dateRange.toDate || new Date().toISOString().slice(0, 10),
        },
      },
    }
    return queryApiPost('/insights', body)
  },

  /**
   * Get funnel data
   * @param {string} funnelId - Mixpanel funnel ID
   * @param {object} dateRange - { fromDate, toDate } in YYYY-MM-DD format
   * @param {object} options - Additional options (dryRun)
   */
  async getFunnel(funnelId, dateRange = {}, options = {}) {
    checkKeys()
    const params = new URLSearchParams()
    params.set('funnel_id', funnelId)
    if (dateRange.fromDate) params.set('from_date', dateRange.fromDate)
    if (dateRange.toDate) params.set('to_date', dateRange.toDate)
    return queryApi('GET', QUERY_URL, '/funnels', params)
  },

  /**
   * Get retention data
   * @param {object} dateRange - { fromDate, toDate } in YYYY-MM-DD format
   * @param {string} bornEvent - Event to count as "born"
   * @param {object} options - Additional options (dryRun)
   */
  async getRetention(dateRange, bornEvent = null, options = {}) {
    checkKeys()
    if (!dateRange.fromDate || !dateRange.toDate) {
      throw new Error('--from-date and --to-date required (YYYY-MM-DD)')
    }
    const params = new URLSearchParams()
    params.set('from_date', dateRange.fromDate)
    params.set('to_date', dateRange.toDate)
    params.set('retention_type', 'birth')
    if (bornEvent) params.set('born_event', bornEvent)
    return queryApi('GET', QUERY_URL, '/retention', params)
  },

  /**
   * Export event data
   * @param {object} dateRange - { fromDate, toDate } in YYYY-MM-DD format
   * @param {string} event - Filter by event name
   * @param {object} options - Additional options (dryRun)
   */
  async exportEvents(dateRange, event = null, options = {}) {
    checkKeys()
    const params = new URLSearchParams()
    params.set('from_date', dateRange.fromDate)
    params.set('to_date', dateRange.toDate)
    if (event) params.set('event', JSON.stringify([event]))
    return queryApi('GET', EXPORT_URL, '/export', params)
  },
}
