// Hotjar CLI wrapper
// Wraps marketingskills/tools/clis/hotjar.js functionality

const CLIENT_ID = process.env.HOTJAR_CLIENT_ID
const CLIENT_SECRET = process.env.HOTJAR_CLIENT_SECRET
const BASE_URL = 'https://api.hotjar.io/v2'

function checkKeys() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('HOTJAR_CLIENT_ID and HOTJAR_CLIENT_SECRET environment variables required')
  }
}

let cachedToken = null

async function getToken() {
  if (cachedToken) return cachedToken
  checkKeys()
  const res = await fetch('https://api.hotjar.io/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`,
  })
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to obtain access token')
  }
  cachedToken = data.access_token
  return cachedToken
}

async function api(method, path, body) {
  checkKeys()
  const token = await getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const Hotjar = {
  /**
   * List sites
   * @param {object} options - Additional options (dryRun)
   */
  async listSites(options = {}) {
    return api('GET', '/sites')
  },

  /**
   * List surveys for a site
   * @param {string} siteId - Hotjar site ID
   * @param {object} options - Additional options
   * @param {number} options.limit - Number of results (default: 100)
   * @param {string} options.cursor - Cursor for pagination
   */
  async listSurveys(siteId, options = {}) {
    checkKeys()
    if (!siteId) throw new Error('siteId required')
    const params = new URLSearchParams({ limit: options.limit || 100 })
    if (options.cursor) params.set('cursor', options.cursor)
    return api('GET', `/sites/${siteId}/surveys?${params}`)
  },

  /**
   * Get survey responses
   * @param {string} siteId - Hotjar site ID
   * @param {string} surveyId - Survey ID
   * @param {object} options - Additional options
   * @param {number} options.limit - Number of results (default: 100)
   * @param {string} options.cursor - Cursor for pagination
   */
  async getSurveyResponses(siteId, surveyId, options = {}) {
    checkKeys()
    if (!siteId || !surveyId) throw new Error('siteId and surveyId required')
    const params = new URLSearchParams({ limit: options.limit || 100 })
    if (options.cursor) params.set('cursor', options.cursor)
    return api('GET', `/sites/${siteId}/surveys/${surveyId}/responses?${params}`)
  },

  /**
   * List heatmaps for a site
   * @param {string} siteId - Hotjar site ID
   * @param {object} options - Additional options
   */
  async listHeatmaps(siteId, options = {}) {
    checkKeys()
    if (!siteId) throw new Error('siteId required')
    return api('GET', `/sites/${siteId}/heatmaps`)
  },

  /**
   * List recordings for a site
   * @param {string} siteId - Hotjar site ID
   * @param {object} options - Additional options
   * @param {number} options.limit - Number of results (default: 100)
   * @param {string} options.cursor - Cursor for pagination
   * @param {string} options.dateFrom - Filter from date
   * @param {string} options.dateTo - Filter to date
   */
  async listRecordings(siteId, options = {}) {
    checkKeys()
    if (!siteId) throw new Error('siteId required')
    const params = new URLSearchParams({ limit: options.limit || 100 })
    if (options.cursor) params.set('cursor', options.cursor)
    if (options.dateFrom) params.set('date_from', options.dateFrom)
    if (options.dateTo) params.set('date_to', options.dateTo)
    return api('GET', `/sites/${siteId}/recordings?${params}`)
  },

  /**
   * List forms for a site
   * @param {string} siteId - Hotjar site ID
   * @param {object} options - Additional options
   */
  async listForms(siteId, options = {}) {
    checkKeys()
    if (!siteId) throw new Error('siteId required')
    return api('GET', `/sites/${siteId}/forms`)
  },
}
