// SEMrush CLI wrapper
// Wraps marketingskills/tools/clis/semrush.js functionality

const API_KEY = process.env.SEMRUSH_API_KEY
const BASE_URL = 'https://api.semrush.com/'

function checkKey() {
  if (!API_KEY) {
    throw new Error('SEMRUSH_API_KEY environment variable required')
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(';')
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = lines[i].split(';')
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || ''
    }
    rows.push(row)
  }
  return rows
}

async function api(params, options = {}) {
  checkKey()
  params.set('key', API_KEY)
  params.set('export_escape', '1')
  if (options.dryRun) {
    const maskedParams = new URLSearchParams(params)
    maskedParams.set('key', '***')
    return { _dry_run: true, method: 'GET', url: `${BASE_URL}?${maskedParams}`, headers: {}, body: undefined }
  }
  const res = await fetch(`${BASE_URL}?${params}`)
  const text = await res.text()
  if (!res.ok) {
    return { error: text.trim(), status: res.status }
  }
  if (text.startsWith('ERROR')) {
    return { error: text.trim() }
  }
  return parseCSV(text)
}

export const Semrush = {
  async domainOverview(domain, options = {}) {
    // Domain overview - get domain ranks
    if (!domain) {
      throw new Error('domain is required')
    }
    const params = new URLSearchParams({
      type: 'domain_ranks',
      export_columns: 'Db,Dn,Rk,Or,Ot,Oc,Ad,At,Ac',
      domain,
    })
    return api(params, options)
  },

  async domainOrganic(domain, options = {}) {
    // Domain organic keywords
    if (!domain) {
      throw new Error('domain is required')
    }
    const database = options.database || 'us'
    const params = new URLSearchParams({
      type: 'domain_organic',
      export_columns: 'Ph,Po,Pp,Pd,Nq,Cp,Ur,Tr,Tc,Co,Nr',
      domain,
      database,
    })
    if (options.limit) params.set('display_limit', String(options.limit))
    return api(params, options)
  },

  async domainCompetitors(domain, options = {}) {
    // Domain competitors
    if (!domain) {
      throw new Error('domain is required')
    }
    const database = options.database || 'us'
    const params = new URLSearchParams({
      type: 'domain_organic_organic',
      export_columns: 'Dn,Cr,Np,Or,Ot,Oc,Ad',
      domain,
      database,
    })
    if (options.limit) params.set('display_limit', String(options.limit))
    return api(params, options)
  },

  async keywordsOverview(phrase, options = {}) {
    // Keyword overview
    if (!phrase) {
      throw new Error('phrase is required')
    }
    const database = options.database || 'us'
    const params = new URLSearchParams({
      type: 'phrase_all',
      export_columns: 'Ph,Nq,Cp,Co,Nr',
      phrase,
      database,
    })
    return api(params, options)
  },

  async keywordsRelated(phrase, options = {}) {
    // Related keywords
    if (!phrase) {
      throw new Error('phrase is required')
    }
    const database = options.database || 'us'
    const params = new URLSearchParams({
      type: 'phrase_related',
      export_columns: 'Ph,Nq,Cp,Co,Nr,Td',
      phrase,
      database,
    })
    if (options.limit) params.set('display_limit', String(options.limit))
    return api(params, options)
  },

  async keywordsDifficulty(phrase, options = {}) {
    // Keyword difficulty
    if (!phrase) {
      throw new Error('phrase is required')
    }
    const database = options.database || 'us'
    const params = new URLSearchParams({
      type: 'phrase_kdi',
      export_columns: 'Ph,Kd',
      phrase,
      database,
    })
    return api(params, options)
  },

  async backlinksOverview(target, options = {}) {
    // Backlinks overview
    const params = new URLSearchParams({
      type: 'backlinks_overview',
      target,
      target_type: 'root_domain',
    })
    return api(params, options)
  },

  async backlinksList(target, options = {}) {
    // Backlinks list
    const params = new URLSearchParams({
      type: 'backlinks',
      target,
      target_type: 'root_domain',
      export_columns: 'source_url,source_title,target_url,anchor',
    })
    if (options.limit) params.set('display_limit', String(options.limit))
    return api(params, options)
  },
}
