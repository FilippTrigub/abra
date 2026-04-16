// HubSpot CLI wrapper

const ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('HUBSPOT_ACCESS_TOKEN environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null, options = {}) {
  checkKey()
  const url = `https://api.hubapi.com${endpoint}`
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  })
  
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const HubSpot = {
  async getContacts(options = {}) {
    const limit = options.limit || 100
    const after = options.after || ''
    return apiCall(`/crm/v3/objects/contacts?limit=${limit}&after=${after}`)
  },

  async createContact(properties) {
    return apiCall('/crm/v3/objects/contacts', 'POST', {
      properties
    })
  },

  async updateContact(contactId, properties) {
    return apiCall(`/crm/v3/objects/contacts/${contactId}`, 'PATCH', {
      properties
    })
  },

  async searchContacts(filterGroups, options = {}) {
    return apiCall('/crm/v3/objects/contacts/search', 'POST', {
      filterGroups,
      limit: options.limit || 100,
      after: options.after || '',
    })
  },

  async getDeals(options = {}) {
    const limit = options.limit || 100
    const after = options.after || ''
    return apiCall(`/crm/v3/objects/deals?limit=${limit}&after=${after}`)
  },

  async createDeal(properties) {
    return apiCall('/crm/v3/objects/deals', 'POST', {
      properties
    })
  },

  async updateDeal(dealId, properties) {
    return apiCall(`/crm/v3/objects/deals/${dealId}`, 'PATCH', {
      properties
    })
  },

  async getPipelines(objectType = 'deals') {
    return apiCall(`/crm/v3/pipelines/${objectType}`)
  },

  async getOwners() {
    return apiCall('/crm/v3/owners')
  },

  async createTicket(properties) {
    return apiCall('/crm/v3/objects/tickets', 'POST', {
      properties
    })
  },

  async getCompanies(options = {}) {
    const limit = options.limit || 100
    const after = options.after || ''
    return apiCall(`/crm/v3/objects/companies?limit=${limit}&after=${after}`)
  },
}
