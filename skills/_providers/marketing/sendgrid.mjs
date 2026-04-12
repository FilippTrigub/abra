// SendGrid CLI wrapper
// Wraps marketingskills/tools/clis/sendgrid.js functionality

const API_KEY = process.env.SENDGRID_API_KEY
const BASE_URL = 'https://api.sendgrid.com/v3'

function checkKey() {
  if (!API_KEY) {
    throw new Error('SENDGRID_API_KEY environment variable required')
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

export const SendGrid = {
  async send(params, options = {}) {
    // params: from, to, subject, template_id, template_data, text, html, cc, bcc, reply_to
    const { from, to, subject, cc, bcc, reply_to } = params
    const body = {
      personalizations: [{
        to: to.split(',').map(e => ({ email: e.trim() })),
      }],
      from: { email: from },
      subject,
    }
    if (cc) {
      body.personalizations[0].cc = cc.split(',').map(e => ({ email: e.trim() }))
    }
    if (bcc) {
      body.personalizations[0].bcc = bcc.split(',').map(e => ({ email: e.trim() }))
    }
    if (reply_to) {
      body.reply_to = { email: reply_to }
    }
    if (params.template_id) {
      body.template_id = params.template_id
      if (params.template_data) {
        body.personalizations[0].dynamic_template_data = params.template_data
      }
    } else {
      const content = []
      if (params.text) content.push({ type: 'text/plain', value: params.text })
      if (params.html) content.push({ type: 'text/html', value: params.html })
      if (content.length > 0) body.content = content
    }
    return api('POST', '/mail/send', body, options)
  },

  async contactsList(options = {}) {
    return api('GET', '/marketing/contacts', null, options)
  },

  async contactsAdd(params, options = {}) {
    // params: email, first_name, last_name, list_ids
    const body = {
      contacts: [{
        email: params.email,
      }],
    }
    if (params.first_name) body.contacts[0].first_name = params.first_name
    if (params.last_name) body.contacts[0].last_name = params.last_name
    if (params.list_ids) body.list_ids = params.list_ids.split(',')
    return api('PUT', '/marketing/contacts', body, options)
  },

  async contactsSearch(query, options = {}) {
    const body = { query }
    return api('POST', '/marketing/contacts/search', body, options)
  },

  async campaignsList(options = {}) {
    const params = new URLSearchParams()
    if (options.limit) params.set('page_size', String(options.limit))
    return api('GET', `/marketing/campaigns?${params}`, null, options)
  },

  async campaignsGet(campaignId, options = {}) {
    return api('GET', `/marketing/campaigns/${campaignId}`, null, options)
  },

  async statsGet(options = {}) {
    // options: start_date, end_date
    const params = new URLSearchParams()
    if (options.startDate) params.set('start_date', options.startDate)
    if (options.endDate) params.set('end_date', options.endDate)
    return api('GET', `/stats?${params}`, null, options)
  },

  async bouncesList(options = {}) {
    // options: start_time, end_time, limit
    const params = new URLSearchParams()
    if (options.startTime) params.set('start_time', options.startTime)
    if (options.endTime) params.set('end_time', options.endTime)
    if (options.limit) params.set('limit', String(options.limit))
    return api('GET', `/suppression/bounces?${params}`, null, options)
  },

  async spamReportsList(options = {}) {
    // options: start_time, end_time, limit
    const params = new URLSearchParams()
    if (options.startTime) params.set('start_time', options.startTime)
    if (options.endTime) params.set('end_time', options.endTime)
    if (options.limit) params.set('limit', String(options.limit))
    return api('GET', `/suppression/spam_reports?${params}`, null, options)
  },

  async validateEmail(email, options = {}) {
    const body = { email }
    return api('POST', '/validations/email', body, options)
  },
}
