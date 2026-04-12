// Resend CLI wrapper
// Wraps marketingskills/tools/clis/resend.js functionality

const API_KEY = process.env.RESEND_API_KEY
const BASE_URL = 'https://api.resend.com'

function checkKey() {
  if (!API_KEY) {
    throw new Error('RESEND_API_KEY environment variable required')
  }
}

async function api(method, path, body = null, options = {}) {
  checkKey()
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  }
  if (options.dryRun) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, body }
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

export const Resend = {
  async send_email(params, options = {}) {
    // params: from, to, subject, html, text, bcc, cc, reply_to, attachments
    return api('POST', '/emails', params, options)
  },

  async batchSend(emails, options = {}) {
    return api('POST', '/emails/batch', { emails }, options)
  },

  async listDomains(options = {}) {
    return api('GET', '/domains', null, options)
  },

  async getDomain(domainId, options = {}) {
    return api('GET', `/domains/${domainId}`, null, options)
  },

  async listAudiences(options = {}) {
    return api('GET', '/audiences', null, options)
  },

  async createAudience(params, options = {}) {
    // params: name, metadata
    return api('POST', '/audiences', params, options)
  },

  async addContact(audienceId, params, options = {}) {
    // params: email, first_name, last_name, timezone
    return api('POST', `/audiences/${audienceId}/contacts`, params, options)
  },
}
