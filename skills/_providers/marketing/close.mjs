// Close.com CLI wrapper

const ACCESS_TOKEN = process.env.CLOSE_API_KEY

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('CLOSE_API_KEY environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKey()
  const url = `https://api.close.com/api/v1${endpoint}`
  
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${ACCESS_TOKEN}:`).toString('base64')}`,
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

export const Close = {
  async getContacts(options = {}) {
    const limit = options.limit || 100
    const skip = options.skip || 0
    return apiCall(`/contact/?limit=${limit}&skip=${skip}`)
  },

  async createContact(data) {
    return apiCall('/contact/', 'POST', data)
  },

  async updateContact(contactId, data) {
    return apiCall(`/contact/${contactId}`, 'PATCH', data)
  },

  async getLeads(options = {}) {
    const limit = options.limit || 100
    const skip = options.skip || 0
    return apiCall(`/lead/?limit=${limit}&skip=${skip}`)
  },

  async createLead(data) {
    return apiCall('/lead/', 'POST', data)
  },

  async updateLead(leadId, data) {
    return apiCall(`/lead/${leadId}`, 'PATCH', data)
  },

  async getOpportunities(options = {}) {
    const limit = options.limit || 100
    const skip = options.skip || 0
    return apiCall(`/opportunity/?limit=${limit}&skip=${skip}`)
  },

  async createOpportunity(data) {
    return apiCall('/opportunity/', 'POST', data)
  },

  async updateOpportunity(opportunityId, data) {
    return apiCall(`/opportunity/${opportunityId}`, 'PATCH', data)
  },

  async searchContacts(query) {
    return apiCall('/contact/', 'GET', null)
  },

  async getActivities(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/activity/?limit=${limit}`)
  },
}
