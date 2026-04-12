// Dub (dub.co) CLI wrapper
// Wraps marketingskills/tools/clis/dub.js functionality

const API_KEY = process.env.DUB_API_KEY
const BASE_URL = 'https://api.dub.co'

function checkKey() {
  if (!API_KEY) {
    throw new Error('DUB_API_KEY environment variable required')
  }
}

async function api(method, path, body = null, options = {}) {
  checkKey()
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  }
  if (options.dryRun) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers, body: body || undefined }
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

export const Dub = {
  async linksCreate(params, options = {}) {
    // params: url, domain, key, tags
    const body = {}
    if (params.url) body.url = params.url
    if (params.domain) body.domain = params.domain
    if (params.key) body.key = params.key
    if (params.tags) body.tags = typeof params.tags === 'string' ? params.tags.split(',') : params.tags
    return api('POST', '/links', body, options)
  },

  async linksList(options = {}) {
    // options: domain, page
    const params = new URLSearchParams()
    if (options.domain) params.set('domain', options.domain)
    if (options.page) params.set('page', String(options.page))
    return api('GET', `/links?${params}`, null, options)
  },

  async linksGet(options = {}) {
    // options: domain, key, linkId, externalId
    const params = new URLSearchParams()
    if (options.domain) params.set('domain', options.domain)
    if (options.key) params.set('key', options.key)
    if (options.linkId) params.set('linkId', options.linkId)
    if (options.externalId) params.set('externalId', options.externalId)
    return api('GET', `/links/info?${params}`, null, options)
  },

  async linksUpdate(params, options = {}) {
    // params: id, url, tags
    if (!params.id) return { error: '--id required (link ID)' }
    const body = {}
    if (params.url) body.url = params.url
    if (params.tags) body.tags = typeof params.tags === 'string' ? params.tags.split(',') : params.tags
    return api('PATCH', `/links/${params.id}`, body, options)
  },

  async linksDelete(linkId, options = {}) {
    return api('DELETE', `/links/${linkId}`, null, options)
  },

  async linksBulkCreate(links, options = {}) {
    // links: array of link objects
    if (!Array.isArray(links)) {
      try {
        links = typeof links === 'string' ? JSON.parse(links) : []
      } catch {
        return { error: 'Invalid JSON in --links' }
      }
    }
    return api('POST', '/links/bulk', links, options)
  },

  async analyticsGet(options = {}) {
    // options: domain, key, interval
    const params = new URLSearchParams()
    if (options.domain) params.set('domain', options.domain)
    if (options.key) params.set('key', options.key)
    if (options.interval) params.set('interval', options.interval)
    return api('GET', `/analytics?${params}`, null, options)
  },

  async analyticsByCountry(options = {}) {
    // options: domain, key
    const params = new URLSearchParams()
    if (options.domain) params.set('domain', options.domain)
    if (options.key) params.set('key', options.key)
    return api('GET', `/analytics/country?${params}`, null, options)
  },

  async analyticsByDevice(options = {}) {
    // options: domain, key
    const params = new URLSearchParams()
    if (options.domain) params.set('domain', options.domain)
    if (options.key) params.set('key', options.key)
    return api('GET', `/analytics/device?${params}`, null, options)
  },
}
