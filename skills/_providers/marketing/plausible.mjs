// Plausible CLI wrapper
// Wraps marketingskills/tools/clis/plausible.js functionality

const API_KEY = process.env.PLAUSIBLE_API_KEY
const BASE_URL = process.env.PLAUSIBLE_BASE_URL || 'https://plausible.io'

function checkKey() {
  if (!API_KEY) {
    throw new Error('PLAUSIBLE_API_KEY environment variable required')
  }
}

async function api(method, path, body = null, options = {}) {
  checkKey()
  if (options.dryRun) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { Authorization: '***', 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
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

export const Plausible = {
  async statsAggregate(siteId, options = {}) {
    // Get aggregate stats
    if (!siteId) {
      throw new Error('siteId is required')
    }
    const metrics = options.metrics || ['visitors', 'pageviews', 'bounce_rate', 'visit_duration']
    return api('POST', '/api/v2/query', {
      site_id: siteId,
      metrics,
      date_range: options.dateRange || '30d',
    }, options)
  },

  async statsTimeseries(siteId, options = {}) {
    // Get timeseries stats
    if (!siteId) {
      throw new Error('siteId is required')
    }
    const metrics = options.metrics || ['visitors', 'pageviews']
    const period = options.period || 'time:day'
    return api('POST', '/api/v2/query', {
      site_id: siteId,
      metrics,
      date_range: options.dateRange || '30d',
      dimensions: [period],
    }, options)
  },

  async statsPages(siteId, options = {}) {
    // Get top pages
    if (!siteId) {
      throw new Error('siteId is required')
    }
    const metrics = options.metrics || ['visitors', 'pageviews']
    const limit = options.limit || 100
    return api('POST', '/api/v2/query', {
      site_id: siteId,
      metrics,
      date_range: options.dateRange || '30d',
      dimensions: ['event:page'],
      pagination: { limit },
    }, options)
  },

  async statsSources(siteId, options = {}) {
    // Get traffic sources
    if (!siteId) {
      throw new Error('siteId is required')
    }
    const metrics = options.metrics || ['visitors', 'bounce_rate']
    return api('POST', '/api/v2/query', {
      site_id: siteId,
      metrics,
      date_range: options.dateRange || '30d',
      dimensions: ['visit:source'],
      pagination: { limit: options.limit || 100 },
    }, options)
  },

  async statsCountries(siteId, options = {}) {
    // Get country breakdown
    if (!siteId) {
      throw new Error('siteId is required')
    }
    const metrics = options.metrics || ['visitors', 'percentage']
    return api('POST', '/api/v2/query', {
      site_id: siteId,
      metrics,
      date_range: options.dateRange || '30d',
      dimensions: ['visit:country'],
      pagination: { limit: options.limit || 100 },
    }, options)
  },

  async statsDevices(siteId, options = {}) {
    // Get device breakdown
    if (!siteId) {
      throw new Error('siteId is required')
    }
    const metrics = options.metrics || ['visitors', 'percentage']
    return api('POST', '/api/v2/query', {
      site_id: siteId,
      metrics,
      date_range: options.dateRange || '30d',
      dimensions: ['visit:device'],
      pagination: { limit: options.limit || 100 },
    }, options)
  },

  async statsUtm(siteId, options = {}) {
    // Get UTM parameter breakdown
    if (!siteId) {
      throw new Error('siteId is required')
    }
    const param = options.param || 'utm_source'
    const metrics = options.metrics || ['visitors', 'bounce_rate']
    return api('POST', '/api/v2/query', {
      site_id: siteId,
      metrics,
      date_range: options.dateRange || '30d',
      dimensions: [`visit:${param}`],
      pagination: { limit: options.limit || 100 },
    }, options)
  },

  async statsQuery(siteId, options = {}) {
    // Custom query
    if (!siteId) {
      throw new Error('siteId is required')
    }
    if (!options.metrics || !Array.isArray(options.metrics)) {
      throw new Error('metrics array is required')
    }
    const body = {
      site_id: siteId,
      metrics: options.metrics,
      date_range: options.dateRange || '30d',
    }
    if (options.dimensions) {
      body.dimensions = Array.isArray(options.dimensions)
        ? options.dimensions
        : options.dimensions.split(',')
    }
    if (options.filters) {
      try {
        body.filters = typeof options.filters === 'string'
          ? JSON.parse(options.filters)
          : options.filters
      } catch {
        throw new Error('filters must be valid JSON')
      }
    }
    body.pagination = { limit: options.limit || 100 }
    return api('POST', '/api/v2/query', body, options)
  },

  async statsRealtime(siteId, options = {}) {
    // Get realtime stats
    if (!siteId) {
      throw new Error('siteId is required')
    }
    return api('GET', `/api/v1/stats/realtime/visitors?site_id=${encodeURIComponent(siteId)}`, null, options)
  },

  async sitesList(options = {}) {
    // List all sites
    return api('GET', '/api/v1/sites', null, options)
  },

  async sitesGet(siteId, options = {}) {
    // Get a specific site
    if (!siteId) {
      throw new Error('siteId is required')
    }
    return api('GET', `/api/v1/sites/${encodeURIComponent(siteId)}`, null, options)
  },

  async sitesCreate(domain, options = {}) {
    // Create a new site
    if (!domain) {
      throw new Error('domain is required')
    }
    const body = { domain }
    if (options.timezone) body.timezone = options.timezone
    return api('POST', '/api/v1/sites', body, options)
  },

  async sitesDelete(siteId, options = {}) {
    // Delete a site
    if (!siteId) {
      throw new Error('siteId is required')
    }
    return api('DELETE', `/api/v1/sites/${encodeURIComponent(siteId)}`, null, options)
  },

  async goalsList(siteId, options = {}) {
    // List goals for a site
    if (!siteId) {
      throw new Error('siteId is required')
    }
    return api('GET', `/api/v1/sites/goals?site_id=${encodeURIComponent(siteId)}`, null, options)
  },

  async goalsCreate(siteId, goalType, options = {}) {
    // Create a goal
    if (!siteId) {
      throw new Error('siteId is required')
    }
    if (!goalType || !['event', 'page'].includes(goalType)) {
      throw new Error('goalType must be "event" or "page"')
    }
    const body = { site_id: siteId, goal_type: goalType }
    if (goalType === 'event') {
      if (!options.eventName) {
        throw new Error('eventName is required for event goals')
      }
      body.event_name = options.eventName
    } else if (goalType === 'page') {
      if (!options.pagePath) {
        throw new Error('pagePath is required for page goals')
      }
      body.page_path = options.pagePath
    }
    return api('PUT', '/api/v1/sites/goals', body, options)
  },

  async goalsDelete(siteId, goalId, options = {}) {
    // Delete a goal
    if (!siteId || !goalId) {
      throw new Error('siteId and goalId are required')
    }
    return api('DELETE', `/api/v1/sites/goals/${goalId}`, { site_id: siteId }, options)
  },
}
