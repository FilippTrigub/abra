// Clearbit CLI wrapper

const ACCESS_TOKEN = process.env.CLEARBIT_API_KEY

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('CLEARBIT_API_KEY environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKey()
  const url = `https://company.clearbit.com/v2${endpoint}`
  
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

export const Clearbit = {
  async getCompany(domain) {
    return apiCall(`/companies/find?domain=${encodeURIComponent(domain)}`)
  },

  async getCompanyById(id) {
    return apiCall(`/companies/${id}`)
  },

  async enrichPerson(email) {
    return apiCall(`/people/find?email=${encodeURIComponent(email)}`)
  },

  async getPersonById(id) {
    return apiCall(`/people/${id}`)
  },

  async getCompanyTechnologies(domain) {
    return apiCall(`/companies/find?domain=${encodeURIComponent(domain)}&include=technologies`)
  },

  async getCompanyMetrics(domain) {
    return apiCall(`/companies/find?domain=${encodeURIComponent(domain)}&include=metrics`)
  },

  async getCompanySocial(domain) {
    return apiCall(`/companies/find?domain=${encodeURIComponent(domain)}&include=social`)
  },
}
