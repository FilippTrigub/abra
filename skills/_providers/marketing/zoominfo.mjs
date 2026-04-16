// ZoomInfo provider
// Generates a JWT access token from username/password at request time (tokens expire in 1 hour)

const USERNAME = process.env.ZOOMINFO_USERNAME
const PASSWORD = process.env.ZOOMINFO_PASSWORD
const BASE_URL = 'https://api.zoominfo.com'

function checkKeys() {
  if (!USERNAME || !PASSWORD) {
    throw new Error('ZOOMINFO_USERNAME and ZOOMINFO_PASSWORD environment variables required')
  }
}

async function getAccessToken() {
  const res = await fetch(`${BASE_URL}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  const data = await res.json()
  if (!data.jwt) {
    throw new Error(`Failed to obtain ZoomInfo access token: ${data.message || 'unknown error'}`)
  }
  return data.jwt
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKeys()
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}/platform/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
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
