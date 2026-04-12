// Google Search Console CLI wrapper
// Wraps marketingskills/tools/clis/google-search-console.js functionality

const ACCESS_TOKEN = process.env.GSC_ACCESS_TOKEN
const BASE_URL = 'https://searchconsole.googleapis.com'

function checkToken() {
  if (!ACCESS_TOKEN) {
    throw new Error('GSC_ACCESS_TOKEN environment variable required')
  }
}

async function api(method, path, body = null, options = {}) {
  checkToken()
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
  if (options.dryRun) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { ...headers, Authorization: '***' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
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
    // Search Analytics - query performance
    // options: startDate, endDate, limit (default 100)
    if (!siteUrl) {
      throw new Error('siteUrl is required')
    }
    const encodedSiteUrl = encodeURIComponent(siteUrl)
    const { startDate, endDate } = getDefaultDates(options.startDate, options.endDate)
    const body = {
      startDate,
      endDate,
      rowLimit: parseInt(options.limit || '100', 10),
      dimensions: ['query'],
    }
    return api('POST', `/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`, body, options)
  },

  async searchPages(siteUrl, options = {}) {
    // Search Analytics - page performance
    if (!siteUrl) {
      throw new Error('siteUrl is required')
    }
    const encodedSiteUrl = encodeURIComponent(siteUrl)
    const { startDate, endDate } = getDefaultDates(options.startDate, options.endDate)
    const body = {
      startDate,
      endDate,
      rowLimit: parseInt(options.limit || '100', 10),
      dimensions: ['page'],
    }
    return api('POST', `/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`, body, options)
  },

  async searchCountries(siteUrl, options = {}) {
    // Search Analytics - country performance
    if (!siteUrl) {
      throw new Error('siteUrl is required')
    }
    const encodedSiteUrl = encodeURIComponent(siteUrl)
    const { startDate, endDate } = getDefaultDates(options.startDate, options.endDate)
    const body = {
      startDate,
      endDate,
      rowLimit: parseInt(options.limit || '100', 10),
      dimensions: ['country'],
    }
    return api('POST', `/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`, body, options)
  },

  async inspectUrl(siteUrl, inspectUrl, options = {}) {
    // URL Inspection API
    if (!siteUrl || !inspectUrl) {
      throw new Error('siteUrl and inspectUrl are required')
    }
    return api('POST', '/v1/urlInspection/index:inspect', {
      inspectionUrl: inspectUrl,
      siteUrl,
    }, options)
  },

  async listSitemaps(siteUrl, options = {}) {
    // List sitemaps for a site
    if (!siteUrl) {
      throw new Error('siteUrl is required')
    }
    const encodedSiteUrl = encodeURIComponent(siteUrl)
    return api('GET', `/webmasters/v3/sites/${encodedSiteUrl}/sitemaps`, null, options)
  },

  async submitSitemap(siteUrl, sitemapUrl, options = {}) {
    // Submit a sitemap
    if (!siteUrl || !sitemapUrl) {
      throw new Error('siteUrl and sitemapUrl are required')
    }
    const encodedSiteUrl = encodeURIComponent(siteUrl)
    const sitemapUrlEncoded = encodeURIComponent(sitemapUrl)
    const result = await api('PUT', `/webmasters/v3/sites/${encodedSiteUrl}/sitemaps/${sitemapUrlEncoded}`, null, options)
    if (!result.body && !result.error) {
      return { success: true, message: 'Sitemap submitted successfully' }
    }
    return result
  },
}
