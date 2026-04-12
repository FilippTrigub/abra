// Outreach CLI wrapper

const ACCESS_TOKEN = process.env.OUTREACH_ACCESS_TOKEN

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('OUTREACH_ACCESS_TOKEN environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKey()
  const url = `https://api.outreach.io/api/v2${endpoint}`
  
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  })
  
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const Outreach = {
  async getProspects(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/prospects?limit=${limit}`)
  },

  async createProspect(data) {
    return apiCall('/prospects', 'POST', {
      data: [data]
    })
  },

  async updateProspect(prospectId, data) {
    return apiCall(`/prospects/${prospectId}`, 'PATCH', {
      data
    })
  },

  async getSequences(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/sequences?limit=${limit}`)
  },

  async enrollProspect(sequenceId, prospectId) {
    return apiCall(`/sequences/${sequenceId}/enrollments`, 'POST', {
      data: {
        type: ' prospectEnrollment',
        attributes: {
          prospectId
        }
      }
    })
  },

  async getMailings(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/mailings?limit=${limit}`)
  },

  async getTemplates(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/templates?limit=${limit}`)
  },

  async getAccounts(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/accounts?limit=${limit}`)
  },

  async createAccount(data) {
    return apiCall('/accounts', 'POST', {
      data: [data]
    })
  },

  async getOpportunities(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/opportunities?limit=${limit}`)
  },
}
