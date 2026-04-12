// ZoomInfo CLI wrapper

const ACCESS_TOKEN = process.env.ZOOMINFO_ACCESS_TOKEN

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('ZOOMINFO_ACCESS_TOKEN environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKey()
  const url = `https://api.zoominfo.com/platform/v1${endpoint}`
  
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

export const ZoomInfo = {
  async searchCompanies(query) {
    return apiCall('/companies/search', 'POST', query)
  },

  async getCompany(companyId) {
    return apiCall(`/companies/${companyId}`)
  },

  async searchContacts(query) {
    return apiCall('/contacts/search', 'POST', query)
  },

  async getContact(contactId) {
    return apiCall(`/contacts/${contactId}`)
  },

  async enrichCompany(domain) {
    return apiCall('/enrich/company', 'POST', { domain })
  },

  async enrichEmail(email) {
    return apiCall('/enrich/email', 'POST', { email })
  },

  async enrichPerson(data) {
    return apiCall('/enrich/person', 'POST', data)
  },
}
