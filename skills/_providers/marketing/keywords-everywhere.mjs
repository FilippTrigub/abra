// Keywords Everywhere CLI wrapper
// Wraps marketingskills/tools/clis/keywords-everywhere.js functionality

const API_KEY = process.env.KEYWORDS_EVERYWHERE_API_KEY
const BASE_URL = 'https://api.keywordseverywhere.com/v1'

function checkKey() {
  if (!API_KEY) {
    throw new Error('KEYWORDS_EVERYWHERE_API_KEY environment variable required')
  }
}

async function api(method, path, body = null, options = {}) {
  checkKey()
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
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

export const KeywordsEverywhere = {
  async keywordsData(kwArray, options = {}) {
    // Get keyword data (search volume, CPC, etc.)
    // kwArray: array of keywords (max 100)
    if (!kwArray || !Array.isArray(kwArray) || kwArray.length === 0) {
      throw new Error('kwArray is required (comma-separated keywords, max 100)')
    }
    const country = options.country || 'us'
    const currency = options.currency || 'USD'
    const dataSource = options.dataSource || 'gkp'
    return api('POST', '/get_keyword_data', {
      country,
      currency,
      dataSource,
      kw: kwArray,
    }, options)
  },

  async keywordsRelated(kwArray, options = {}) {
    // Get related keywords
    if (!kwArray || !Array.isArray(kwArray) || kwArray.length === 0) {
      throw new Error('kwArray is required')
    }
    const country = options.country || 'us'
    const currency = options.currency || 'USD'
    const dataSource = options.dataSource || 'gkp'
    return api('POST', '/get_related_keywords', {
      country,
      currency,
      dataSource,
      kw: kwArray,
    }, options)
  },

  async keywordsPasf(kwArray, options = {}) {
    // Get People Also Search For (PASF) keywords
    if (!kwArray || !Array.isArray(kwArray) || kwArray.length === 0) {
      throw new Error('kwArray is required')
    }
    const country = options.country || 'us'
    const currency = options.currency || 'USD'
    const dataSource = options.dataSource || 'gkp'
    return api('POST', '/get_pasf_keywords', {
      country,
      currency,
      dataSource,
      kw: kwArray,
    }, options)
  },

  async domainKeywords(domain, options = {}) {
    // Get keywords for a domain
    if (!domain) {
      throw new Error('domain is required')
    }
    const country = options.country || 'us'
    const currency = options.currency || 'USD'
    return api('POST', '/get_domain_keywords', {
      country,
      currency,
      domain,
    }, options)
  },

  async domainTraffic(domain, options = {}) {
    // Get traffic estimates for a domain
    if (!domain) {
      throw new Error('domain is required')
    }
    const country = options.country || 'us'
    return api('POST', '/get_domain_traffic', {
      country,
      domain,
    }, options)
  },

  async domainBacklinks(domain, options = {}) {
    // Get backlinks for a domain
    if (!domain) {
      throw new Error('domain is required')
    }
    return api('POST', '/get_domain_backlinks', {
      domain,
    }, options)
  },

  async domainUniqueBacklinks(domain, options = {}) {
    // Get unique backlinks for a domain
    if (!domain) {
      throw new Error('domain is required')
    }
    return api('POST', '/get_unique_domain_backlinks', {
      domain,
    }, options)
  },

  async urlKeywords(url, options = {}) {
    // Get keywords for a URL
    if (!url) {
      throw new Error('url is required')
    }
    const country = options.country || 'us'
    const currency = options.currency || 'USD'
    return api('POST', '/get_url_keywords', {
      country,
      currency,
      url,
    }, options)
  },

  async urlTraffic(url, options = {}) {
    // Get traffic estimates for a URL
    if (!url) {
      throw new Error('url is required')
    }
    const country = options.country || 'us'
    return api('POST', '/get_url_traffic', {
      country,
      url,
    }, options)
  },

  async urlBacklinks(url, options = {}) {
    // Get backlinks for a URL
    if (!url) {
      throw new Error('url is required')
    }
    return api('POST', '/get_page_backlinks', {
      url,
    }, options)
  },

  async urlUniqueBacklinks(url, options = {}) {
    // Get unique backlinks for a URL
    if (!url) {
      throw new Error('url is required')
    }
    return api('POST', '/get_unique_page_backlinks', {
      url,
    }, options)
  },

  async accountCredits() {
    // Get account credits
    return api('GET', '/get_credits', null, null)
  },

  async accountCountries() {
    // Get available countries
    return api('GET', '/get_countries', null, null)
  },

  async accountCurrencies() {
    // Get available currencies
    return api('GET', '/get_currencies', null, null)
  },
}
