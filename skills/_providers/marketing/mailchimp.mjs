// Mailchimp CLI wrapper
// Wraps marketingskills/tools/clis/mailchimp.js functionality

const API_KEY = process.env.MAILCHIMP_API_KEY
const SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX

function checkKey() {
  if (!API_KEY) {
    throw new Error('MAILCHIMP_API_KEY environment variable required')
  }
}

function getDC() {
  if (SERVER_PREFIX) return SERVER_PREFIX
  // Fall back to parsing from key format (key-dc) if prefix not explicitly set
  const parts = API_KEY.split('-')
  if (parts.length < 2) {
    throw new Error('Cannot determine data center: set MAILCHIMP_SERVER_PREFIX or use a key in key-dc format')
  }
  return parts[parts.length - 1]
}

function getBaseUrl() {
  return `https://${getDC()}.api.mailchimp.com/3.0`
}

async function api(method, path, body = null, options = {}) {
  checkKey()
  const headers = {
    'Authorization': `Basic ${Buffer.from(`anystring:${API_KEY}`).toString('base64')}`,
    'Content-Type': 'application/json',
  }
  const url = `${getBaseUrl()}${path}`
  if (options.dryRun) {
    return { _dry_run: true, method, url, body }
  }
  const res = await fetch(url, {
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

export const Mailchimp = {
  async ping(options = {}) {
    return api('GET', '/ping', null, options)
  },

  async listAudiences(options = {}) {
    return api('GET', '/lists', null, options)
  },

  async getAudience(listId, options = {}) {
    return api('GET', `/lists/${listId}`, null, options)
  },

  async listCampaigns(options = {}) {
    const params = new URLSearchParams()
    if (options.type) params.set('type', options.type)
    if (options.status) params.set('status', options.status)
    if (options.count) params.set('count', String(options.count))
    const qs = params.toString() ? `?${params.toString()}` : ''
    return api('GET', `/campaigns${qs}`, null, options)
  },

  async getCampaign(campaignId, options = {}) {
    return api('GET', `/campaigns/${campaignId}`, null, options)
  },

  async createCampaign(params, options = {}) {
    // params: type, recipients, settings
    return api('POST', '/campaigns', params, options)
  },

  async sendCampaign(campaignId, options = {}) {
    return api('POST', `/campaigns/${campaignId}/actions/send`, null, options)
  },

  async scheduleCampaign(campaignId, scheduleTime, options = {}) {
    return api('POST', `/campaigns/${campaignId}/actions/schedule`, { schedule_time: scheduleTime }, options)
  },
}
