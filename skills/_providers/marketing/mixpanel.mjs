// Mixpanel CLI wrapper
// Wraps marketingskills/tools/clis/mixpanel.js functionality

const SA_USERNAME = process.env.MIXPANEL_SA_USERNAME
const SECRET = process.env.MIXPANEL_SECRET
const QUERY_URL = 'https://mixpanel.com/api/2.0'
const EXPORT_URL = 'https://data.mixpanel.com/api/2.0'

function checkKeys() {
  if (!SA_USERNAME || !SECRET) {
    throw new Error('MIXPANEL_SA_USERNAME and MIXPANEL_SECRET (service account credentials) environment variables required')
  }
}

async function queryApi(method, baseUrl, path, params) {
  checkKeys()
  const auth = Buffer.from(`${SA_USERNAME}:${SECRET}`).toString('base64')
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
  checkKeys()
  const auth = Buffer.from(`${SA_USERNAME}:${SECRET}`).toString('base64')
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
