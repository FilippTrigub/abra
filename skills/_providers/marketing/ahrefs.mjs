// Ahrefs CLI wrapper
// Wraps marketingskills/tools/clis/ahrefs.js functionality

const API_KEY = process.env.AHREFS_API_KEY
const BASE_URL = 'https://api.ahrefs.com/v3'

function checkKey() {
  if (!API_KEY) {
    throw new Error('AHREFS_API_KEY environment variable required')
  }
}

async function api(method, path, options = {}) {
  checkKey()
  if (options.dryRun) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { 'Authorization': '***', 'Content-Type': 'application/json' } }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
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

export const Ahrefs = {
  async domainRatingGet(target, options = {}) {
    // Get domain rating
    if (!target) {
      throw new Error('target is required')
    }
    const params = new URLSearchParams({ target })
    return api('GET', `/site-explorer/domain-rating?${params}`, options)
  },

  async backlinksList(target, options = {}) {
    // List backlinks
    if (!target) {
      throw new Error('target is required')
    }
    const mode = options.mode || 'domain'
    const params = new URLSearchParams({ target, mode })
    if (options.limit) params.set('limit', String(options.limit))
    return api('GET', `/site-explorer/backlinks?${params}`, options)
  },

  async refdomainsList(target, options = {}) {
    // List referring domains
    if (!target) {
      throw new Error('target is required')
    }
    const mode = options.mode || 'domain'
    const params = new URLSearchParams({ target, mode })
    if (options.limit) params.set('limit', String(options.limit))
    return api('GET', `/site-explorer/refdomains?${params}`, options)
  },

  async keywordsOrganic(target, options = {}) {
    // Organic keywords
    if (!target) {
      throw new Error('target is required')
    }
    const params = new URLSearchParams({ target, mode: options.mode || 'domain' })
    if (options.country) params.set('country', options.country)
    if (options.limit) params.set('limit', String(options.limit))
    return api('GET', `/site-explorer/organic-keywords?${params}`, options)
  },

  async topPagesList(target, options = {}) {
    // Top pages
    if (!target) {
      throw new Error('target is required')
    }
    const params = new URLSearchParams({ target, mode: options.mode || 'domain' })
    if (options.country) params.set('country', options.country)
    if (options.limit) params.set('limit', String(options.limit))
    return api('GET', `/site-explorer/top-pages?${params}`, options)
  },

  async keywordOverviewGet(keywords, options = {}) {
    // Keyword overview (multiple keywords)
    const params = new URLSearchParams({ keywords })
    if (options.country) params.set('country', options.country)
    return api('GET', `/keywords-explorer/overview?${params}`, options)
  },

  async keywordSuggestionsGet(keyword, options = {}) {
    // Keyword suggestions
    const params = new URLSearchParams({ keyword })
    if (options.country) params.set('country', options.country)
    if (options.limit) params.set('limit', String(options.limit))
    return api('GET', `/keywords-explorer/matching-terms?${params}`, options)
  },

  async serpGet(keyword, options = {}) {
    // SERP overview
    const params = new URLSearchParams({ keyword })
    if (options.country) params.set('country', options.country)
    return api('GET', `/keywords-explorer/serp-overview?${params}`, options)
  },
}
