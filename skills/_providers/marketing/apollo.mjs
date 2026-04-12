// Apollo CLI wrapper

const ACCESS_TOKEN = process.env.APOLLO_API_KEY

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('APOLLO_API_KEY environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKey()
  const url = `https://api.apollo.io/v1${endpoint}`
  
  const res = await fetch(url, {
    method,
    headers: {
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

export const Apollo = {
  async searchCompanies(query) {
    return apiCall('/companies/search', 'POST', {
      api_key: ACCESS_TOKEN,
      ...query
    })
  },

  async searchPeople(query) {
    return apiCall('/people/search', 'POST', {
      api_key: ACCESS_TOKEN,
      ...query
    })
  },

  async getCompany(companyId) {
    return apiCall(`/companies/${companyId}`)
  },

  async getPerson(personId) {
    return apiCall(`/people/${personId}`)
  },

  async enrichPerson(email) {
    return apiCall('/people/match', 'POST', {
      api_key: ACCESS_TOKEN,
      email
    })
  },

  async enrichCompany(domain) {
    return apiCall('/companies/match', 'POST', {
      api_key: ACCESS_TOKEN,
      domain
    })
  },

  async getContactById(contactId) {
    return apiCall(`/contacts/${contactId}`)
  },

  async getContactsByDomain(domain, options = {}) {
    const limit = options.limit || 100
    return apiCall('/contacts/search', 'POST', {
      api_key: ACCESS_TOKEN,
      domain,
      page: options.page || 1,
      per_page: limit
    })
  },
}
