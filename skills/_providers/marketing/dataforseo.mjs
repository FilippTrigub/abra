// DataForSEO CLI wrapper
// Wraps marketingskills/tools/clis/dataforseo.js functionality

const LOGIN = process.env.DATAFORSEO_LOGIN
const PASSWORD = process.env.DATAFORSEO_PASSWORD
const BASE_URL = 'https://api.dataforseo.com/v3'

function checkAuth() {
  if (!LOGIN || !PASSWORD) {
    throw new Error('DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables required')
  }
}

async function api(method, path, body = null, options = {}) {
  checkAuth()
  const auth = 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64')
  if (options.dryRun) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { Authorization: '***', 'Content-Type': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': auth,
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

export const DataForSEO = {
  async serpGoogle(keyword, options = {}) {
    // Google SERP live data
    if (!keyword) {
      throw new Error('keyword is required')
    }
    const location = options.location || 'United States'
    const language = options.language || 'English'
    return api('POST', '/serp/google/organic/live/regular', [{
      keyword,
      location_name: location,
      language_name: language,
    }], options)
  },

  async serpLocations() {
    // Get available locations
    return api('GET', '/serp/google/locations', null, null)
  },

  async serpLanguages() {
    // Get available languages
    return api('GET', '/serp/google/languages', null, null)
  },

  async keywordsVolume(keywords, options = {}) {
    // Keyword volume data
    if (!keywords || !Array.isArray(keywords)) {
      throw new Error('keywords array is required')
    }
    const locationCode = options.locationCode || 2840
    const languageCode = options.languageCode || 'en'
    return api('POST', '/keywords_data/google_ads/search_volume/live', [{
      keywords,
      location_code: locationCode,
      language_code: languageCode,
    }], options)
  },

  async keywordsForSite(target, options = {}) {
    // Keywords for a site
    if (!target) {
      throw new Error('target is required')
    }
    const locationCode = options.locationCode || 2840
    const languageCode = options.languageCode || 'en'
    return api('POST', '/keywords_data/google_ads/keywords_for_site/live', [{
      target,
      location_code: locationCode,
      language_code: languageCode,
    }], options)
  },

  async keywordsForKeywords(keywords, options = {}) {
    // Keywords related to keywords
    if (!keywords || !Array.isArray(keywords)) {
      throw new Error('keywords array is required')
    }
    const locationCode = options.locationCode || 2840
    const languageCode = options.languageCode || 'en'
    return api('POST', '/keywords_data/google_ads/keywords_for_keywords/live', [{
      keywords,
      location_code: locationCode,
      language_code: languageCode,
    }], options)
  },

  async keywordsTrends(keywords, options = {}) {
    // Keyword trends
    if (!keywords || !Array.isArray(keywords)) {
      throw new Error('keywords array is required')
    }
    const locationCode = options.locationCode || 2840
    const languageCode = options.languageCode || 'en'
    return api('POST', '/keywords_data/google_trends/explore/live', [{
      keywords,
      location_code: locationCode,
      language_code: languageCode,
    }], options)
  },

  async backlinksSummary(target, options = {}) {
    // Backlinks summary
    if (!target) {
      throw new Error('target is required')
    }
    return api('POST', '/backlinks/summary/live', [{
      target,
      backlinks_status_type: 'live',
    }], options)
  },

  async backlinksList(target, options = {}) {
    // Backlinks list
    if (!target) {
      throw new Error('target is required')
    }
    const limit = options.limit || 100
    return api('POST', '/backlinks/backlinks/live', [{
      target,
      mode: options.mode || 'as_is',
      limit,
      backlinks_status_type: 'live',
    }], options)
  },

  async backlinksRefdomains(target, options = {}) {
    // Referring domains
    if (!target) {
      throw new Error('target is required')
    }
    const limit = options.limit || 100
    return api('POST', '/backlinks/referring_domains/live', [{
      target,
      limit,
    }], options)
  },

  async backlinksAnchors(target, options = {}) {
    // Anchor texts
    if (!target) {
      throw new Error('target is required')
    }
    const limit = options.limit || 100
    return api('POST', '/backlinks/anchors/live', [{
      target,
      limit,
    }], options)
  },

  async backlinksIndex() {
    // Get backlinks index
    return api('GET', '/backlinks/index', null, null)
  },

  async onpageAudit(url, options = {}) {
    // On-page audit
    if (!url) {
      throw new Error('url is required')
    }
    return api('POST', '/on_page/instant_pages', [{
      url,
      enable_javascript: options.noJs === false ? false : true,
    }], options)
  },

  async labsCompetitors(target, options = {}) {
    // Competitors analysis
    if (!target) {
      throw new Error('target is required')
    }
    const locationCode = options.locationCode || 2840
    const languageCode = options.languageCode || 'en'
    const limit = options.limit || 100
    return api('POST', '/dataforseo_labs/google/competitors_domain/live', [{
      target,
      location_code: locationCode,
      language_code: languageCode,
      limit,
    }], options)
  },

  async labsRankedKeywords(target, options = {}) {
    // Ranked keywords
    if (!target) {
      throw new Error('target is required')
    }
    const locationCode = options.locationCode || 2840
    const languageCode = options.languageCode || 'en'
    const limit = options.limit || 100
    return api('POST', '/dataforseo_labs/google/ranked_keywords/live', [{
      target,
      location_code: locationCode,
      language_code: languageCode,
      limit,
    }], options)
  },

  async labsDomainIntersection(targets, options = {}) {
    // Domain intersection (shared keywords between multiple domains)
    if (!targets || !Array.isArray(targets) || targets.length < 2) {
      throw new Error('targets array with at least 2 domains is required')
    }
    const locationCode = options.locationCode || 2840
    const languageCode = options.languageCode || 'en'
    const limit = options.limit || 100
    const payload = { location_code: locationCode, language_code: languageCode, limit }
    targets.forEach((t, i) => { payload[`target${i + 1}`] = t })
    return api('POST', '/dataforseo_labs/google/domain_intersection/live', [payload], options)
  },
}
