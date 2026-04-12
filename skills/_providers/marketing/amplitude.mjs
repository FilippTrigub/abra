// Amplitude CLI wrapper
// Wraps marketingskills/tools/clis/amplitude.js functionality

const API_KEY = process.env.AMPLITUDE_API_KEY
const SECRET_KEY = process.env.AMPLITUDE_SECRET_KEY
const INGESTION_URL = 'https://api2.amplitude.com'
const QUERY_URL = 'https://amplitude.com/api/2'

function checkKey() {
  if (!API_KEY) {
    throw new Error('AMPLITUDE_API_KEY environment variable required')
  }
}

async function ingestApi(method, path, body) {
  checkKey()
  const res = await fetch(`${INGESTION_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

async function queryApi(method, path, params) {
  if (!SECRET_KEY) {
    throw new Error('AMPLITUDE_SECRET_KEY required for query/export operations')
  }
  const url = params ? `${QUERY_URL}${path}?${params}` : `${QUERY_URL}${path}`
  const auth = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64')
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const Amplitude = {
  /**
   * Track a single event
   * @param {string} userId - User ID
   * @param {string} eventType - Event type name
   * @param {object} properties - Event properties
   * @param {object} options - Additional options (dryRun)
   */
  async trackEvent(userId, eventType, properties = {}, options = {}) {
    checkKey()
    const event = {
      user_id: userId,
      event_type: eventType,
    }
    if (Object.keys(properties).length > 0) {
      event.event_properties = properties
    }
    return ingestApi('POST', '/2/httpapi', {
      api_key: API_KEY,
      events: [event],
    })
  },

  /**
   * Track multiple events in a batch
   * @param {array} events - Array of event objects
   * @param {object} options - Additional options (dryRun)
   */
  async batchTrack(events, options = {}) {
    checkKey()
    if (!Array.isArray(events)) {
      throw new Error('events must be an array')
    }
    return ingestApi('POST', '/batch', {
      api_key: API_KEY,
      events,
    })
  },

  /**
   * Get user activity
   * @param {string} userId - User ID
   * @param {object} options - Additional options (dryRun)
   */
  async getUserActivity(userId, options = {}) {
    checkKey()
    if (!SECRET_KEY) {
      throw new Error('AMPLITUDE_SECRET_KEY required for user activity')
    }
    const params = new URLSearchParams()
    params.set('user', userId)
    return queryApi('GET', '/useractivity', params)
  },

  /**
   * Export events data
   * @param {string} start - Start date (YYYYMMDDThh format)
   * @param {string} end - End date (YYYYMMDDThh format)
   * @param {object} options - Additional options (dryRun)
   */
  async exportEvents(start, end, options = {}) {
    checkKey()
    if (!SECRET_KEY) {
      throw new Error('AMPLITUDE_SECRET_KEY required for export')
    }
    const params = new URLSearchParams()
    params.set('start', start)
    params.set('end', end)
    return queryApi('GET', '/export', params)
  },

  /**
   * Get retention data
   * @param {string} start - Start date (YYYYMMDD format)
   * @param {string} end - End date (YYYYMMDD format)
   * @param {string} event - Event type to analyze
   * @param {object} options - Additional options (dryRun)
   */
  async getRetention(start, end, event = null, options = {}) {
    checkKey()
    if (!SECRET_KEY) {
      throw new Error('AMPLITUDE_SECRET_KEY required for retention')
    }
    const params = new URLSearchParams()
    params.set('start', start)
    params.set('end', end)
    if (event) {
      params.set('e', JSON.stringify([{ event_type: event }]))
    }
    return queryApi('GET', '/retention', params)
  },
}
