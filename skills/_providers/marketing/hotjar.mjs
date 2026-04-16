// Hotjar provider
// Uses HOTJAR_API_TOKEN (personal API token) as a Bearer token

const SITE_ID = process.env.HOTJAR_SITE_ID
const API_TOKEN = process.env.HOTJAR_API_TOKEN
const BASE_URL = 'https://api.hotjar.io/v2'

function checkKeys() {
  if (!API_TOKEN) {
    throw new Error('HOTJAR_API_TOKEN environment variable required')
  }
}

async function api(method, path, body) {
  checkKeys()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
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

function siteId(override) {
  const id = override || SITE_ID
  if (!id) throw new Error('siteId required (or set HOTJAR_SITE_ID)')
  return id
}

export const Hotjar = {
  async listSites() {
    return api('GET', '/sites')
  },

  async listSurveys(site, options = {}) {
    const id = siteId(site)
    const params = new URLSearchParams({ limit: options.limit || 100 })
    if (options.cursor) params.set('cursor', options.cursor)
    return api('GET', `/sites/${id}/surveys?${params}`)
  },

  async getSurveyResponses(site, surveyId, options = {}) {
    const id = siteId(site)
    if (!surveyId) throw new Error('surveyId required')
    const params = new URLSearchParams({ limit: options.limit || 100 })
    if (options.cursor) params.set('cursor', options.cursor)
    return api('GET', `/sites/${id}/surveys/${surveyId}/responses?${params}`)
  },

  async listHeatmaps(site) {
    return api('GET', `/sites/${siteId(site)}/heatmaps`)
  },

  async listRecordings(site, options = {}) {
    const id = siteId(site)
    const params = new URLSearchParams({ limit: options.limit || 100 })
    if (options.cursor) params.set('cursor', options.cursor)
    if (options.dateFrom) params.set('date_from', options.dateFrom)
    if (options.dateTo) params.set('date_to', options.dateTo)
    return api('GET', `/sites/${id}/recordings?${params}`)
  },

  async listForms(site) {
    return api('GET', `/sites/${siteId(site)}/forms`)
  },
}
