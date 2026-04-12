// Kit (ConvertKit) CLI wrapper
// Wraps marketingskills/tools/clis/kit.js functionality

const API_SECRET = process.env.KIT_API_SECRET
const API_KEY = process.env.KIT_API_KEY
const BASE_URL = 'https://api.convertkit.com/v3'

function checkKey() {
  if (!API_SECRET && !API_KEY) {
    throw new Error('KIT_API_SECRET or KIT_API_KEY environment variable required')
  }
}

async function api(method, path, body = null, useSecret = true, options = {}) {
  checkKey()
  const url = new URL(`${BASE_URL}${path}`)
  if (method === 'GET' || method === 'DELETE') {
    if (useSecret && API_SECRET) {
      url.searchParams.set('api_secret', API_SECRET)
    } else if (useSecret && !API_SECRET) {
      return { error: 'KIT_API_SECRET required for this endpoint' }
    } else if (API_KEY) {
      url.searchParams.set('api_key', API_KEY)
    }
  }
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body && (method === 'POST' || method === 'PUT')) {
    const authBody = { ...body }
    if (useSecret && API_SECRET) {
      authBody.api_secret = API_SECRET
    } else if (useSecret && !API_SECRET) {
      return { error: 'KIT_API_SECRET required for this endpoint' }
    } else if (API_KEY) {
      authBody.api_key = API_KEY
    }
    opts.body = JSON.stringify(authBody)
  }
  if (options.dryRun) {
    const dryRunHeaders = { ...opts.headers }
    const dryRunUrl = url.toString().replace(API_SECRET, '***').replace(API_KEY, '***')
    let dryRunBody = undefined
    if (opts.body) {
      const parsed = JSON.parse(opts.body)
      if (parsed.api_secret) parsed.api_secret = '***'
      if (parsed.api_key) parsed.api_key = '***'
      dryRunBody = parsed
    }
    return { _dry_run: true, method, url: dryRunUrl, headers: dryRunHeaders, body: dryRunBody }
  }
  const res = await fetch(url.toString(), opts)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const Kit = {
  async subscribersList(options = {}) {
    // options: page
    const params = options.page ? `&page=${options.page}` : ''
    return api('GET', `/subscribers?${params}`, null, true, options)
  },

  async subscribersGet(subscriberId, options = {}) {
    return api('GET', `/subscribers/${subscriberId}`, null, true, options)
  },

  async subscribersUpdate(subscriberId, params, options = {}) {
    // params: first_name, fields
    const body = {}
    if (params.firstName) body.first_name = params.firstName
    if (params.fields) {
      try { body.fields = typeof params.fields === 'string' ? JSON.parse(params.fields) : params.fields }
      catch { return { error: 'Invalid JSON in --fields' } }
    }
    return api('PUT', `/subscribers/${subscriberId}`, body, true, options)
  },

  async subscribersUnsubscribe(params, options = {}) {
    // params: email
    const body = { email: params.email }
    return api('PUT', '/unsubscribe', body, true, options)
  },

  async formsList(options = {}) {
    return api('GET', '/forms', null, false, options)
  },

  async formsSubscribe(formId, params, options = {}) {
    // params: email, first_name, fields
    const body = { email: params.email }
    if (params.firstName) body.first_name = params.firstName
    if (params.fields) {
      try { body.fields = typeof params.fields === 'string' ? JSON.parse(params.fields) : params.fields }
      catch { return { error: 'Invalid JSON in --fields' } }
    }
    return api('POST', `/forms/${formId}/subscribe`, body, false, options)
  },

  async sequencesList(options = {}) {
    return api('GET', '/sequences', null, false, options)
  },

  async sequencesSubscribe(sequenceId, params, options = {}) {
    // params: email, first_name, fields
    const body = { email: params.email }
    if (params.firstName) body.first_name = params.firstName
    if (params.fields) {
      try { body.fields = typeof params.fields === 'string' ? JSON.parse(params.fields) : params.fields }
      catch { return { error: 'Invalid JSON in --fields' } }
    }
    return api('POST', `/sequences/${sequenceId}/subscribe`, body, false, options)
  },

  async tagsList(options = {}) {
    return api('GET', '/tags', null, false, options)
  },

  async tagsSubscribe(tagId, params, options = {}) {
    // params: email, first_name, fields
    const body = { email: params.email }
    if (params.firstName) body.first_name = params.firstName
    if (params.fields) {
      try { body.fields = typeof params.fields === 'string' ? JSON.parse(params.fields) : params.fields }
      catch { return { error: 'Invalid JSON in --fields' } }
    }
    return api('POST', `/tags/${tagId}/subscribe`, body, false, options)
  },

  async tagsRemove(tagId, subscriberId, options = {}) {
    // options: subscriber_id (alternative)
    const actualSubscriberId = subscriberId || options.subscriberId
    if (!actualSubscriberId) return { error: 'Subscriber ID required' }
    return api('DELETE', `/subscribers/${actualSubscriberId}/tags/${tagId}`, null, true, options)
  },

  async broadcastsList(options = {}) {
    const params = options.page ? `&page=${options.page}` : ''
    return api('GET', `/broadcasts?${params}`, null, false, options)
  },

  async broadcastsCreate(params, options = {}) {
    // params: subject, content, email_layout_template
    const body = {
      subject: params.subject,
      content: params.content,
    }
    if (params.emailLayoutTemplate) body.email_layout_template = params.emailLayoutTemplate
    return api('POST', '/broadcasts', body, false, options)
  },
}
