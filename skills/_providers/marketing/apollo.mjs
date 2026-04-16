// Apollo.io provider

const API_KEY = process.env.APOLLO_API_KEY

function checkKey() {
  if (!API_KEY) {
    throw new Error('APOLLO_API_KEY environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKey()
  // GET requests pass api_key as query param; POST requests embed it in the body
  const url = method === 'GET'
    ? `https://api.apollo.io/v1${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${API_KEY}`
    : `https://api.apollo.io/v1${endpoint}`
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const Apollo = {
  async searchCompanies(query) {
    return apiCall('/companies/search', 'POST', { api_key: API_KEY, ...query })
  },

  async searchPeople(query) {
    return apiCall('/people/search', 'POST', { api_key: API_KEY, ...query })
  },

  async getCompany(companyId) {
    return apiCall(`/companies/${companyId}`)
  },

  async getPerson(personId) {
    return apiCall(`/people/${personId}`)
  },

  async enrichPerson(email) {
    return apiCall('/people/match', 'POST', { api_key: API_KEY, email })
  },

  async enrichCompany(domain) {
    return apiCall('/companies/match', 'POST', { api_key: API_KEY, domain })
  },

  async getContactById(contactId) {
    return apiCall(`/contacts/${contactId}`)
  },

  async getContactsByDomain(domain, options = {}) {
    return apiCall('/contacts/search', 'POST', {
      api_key: API_KEY,
      domain,
      page: options.page || 1,
      per_page: options.limit || 100,
    })
  },
}
