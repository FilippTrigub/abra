// Google Search Console provider
// Uses OAuth2 refresh token flow to obtain fresh access tokens at request time

const CLIENT_ID = process.env.GSC_CLIENT_ID
const CLIENT_SECRET = process.env.GSC_CLIENT_SECRET
const REFRESH_TOKEN = process.env.GSC_REFRESH_TOKEN

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const BASE_URL = 'https://searchconsole.googleapis.com'

function checkKeys() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REFRESH_TOKEN environment variables required')
  }
}

async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`Failed to obtain access token: ${data.error_description || data.error || 'unknown error'}`)
  }
  return data.access_token
}

async function api(method, path, body = null) {
  checkKeys()
  const accessToken = await getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
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

function getDefaultDates(startDateArg, endDateArg) {
  const end = new Date()
  end.setDate(end.getDate() - 3)
  const start = new Date(end)
  start.setDate(start.getDate() - 28)
  return {
    startDate: startDateArg || start.toISOString().split('T')[0],
    endDate: endDateArg || end.toISOString().split('T')[0],
  }
}

export const GSC = {
  async searchQuery(siteUrl, options = {}) {
    if (!siteUrl) throw new Error('siteUrl is required')
    const { startDate, endDate } = getDefaultDates(options.startDate, options.endDate)
    return api('POST', `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      startDate,
      endDate,
      rowLimit: parseInt(options.limit || '100', 10),
      dimensions: ['query'],
    })
  },

  async searchPages(siteUrl, options = {}) {
    if (!siteUrl) throw new Error('siteUrl is required')
    const { startDate, endDate } = getDefaultDates(options.startDate, options.endDate)
    return api('POST', `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      startDate,
      endDate,
      rowLimit: parseInt(options.limit || '100', 10),
      dimensions: ['page'],
    })
  },

  async searchCountries(siteUrl, options = {}) {
    if (!siteUrl) throw new Error('siteUrl is required')
    const { startDate, endDate } = getDefaultDates(options.startDate, options.endDate)
    return api('POST', `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      startDate,
      endDate,
      rowLimit: parseInt(options.limit || '100', 10),
      dimensions: ['country'],
    })
  },

  async inspectUrl(siteUrl, inspectUrl) {
    if (!siteUrl || !inspectUrl) throw new Error('siteUrl and inspectUrl are required')
    return api('POST', '/v1/urlInspection/index:inspect', {
      inspectionUrl: inspectUrl,
      siteUrl,
    })
  },

  async listSitemaps(siteUrl) {
    if (!siteUrl) throw new Error('siteUrl is required')
    return api('GET', `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`)
  },

  async submitSitemap(siteUrl, sitemapUrl) {
    if (!siteUrl || !sitemapUrl) throw new Error('siteUrl and sitemapUrl are required')
    const result = await api('PUT', `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`)
    if (!result.body && !result.error) {
      return { success: true, message: 'Sitemap submitted successfully' }
    }
    return result
  },
}
