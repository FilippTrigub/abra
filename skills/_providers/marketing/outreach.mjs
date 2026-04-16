// Outreach provider
// Uses OAuth2 refresh token flow to obtain fresh access tokens at request time (tokens expire in 24h)

const CLIENT_ID = process.env.OUTREACH_CLIENT_ID
const CLIENT_SECRET = process.env.OUTREACH_CLIENT_SECRET
const REFRESH_TOKEN = process.env.OUTREACH_REFRESH_TOKEN

const TOKEN_URL = 'https://api.outreach.io/oauth/token'
const BASE_URL = 'https://api.outreach.io/api/v2'

function checkKeys() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('OUTREACH_CLIENT_ID, OUTREACH_CLIENT_SECRET, and OUTREACH_REFRESH_TOKEN environment variables required')
  }
}

async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`Failed to obtain Outreach access token: ${data.error_description || data.error || 'unknown error'}`)
  }
  return data.access_token
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKeys()
  const accessToken = await getAccessToken()
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
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
    return apiCall(`/prospects?limit=${options.limit || 100}`)
  },

  async createProspect(data) {
    return apiCall('/prospects', 'POST', { data: [data] })
  },

  async updateProspect(prospectId, data) {
    return apiCall(`/prospects/${prospectId}`, 'PATCH', { data })
  },

  async getSequences(options = {}) {
    return apiCall(`/sequences?limit=${options.limit || 100}`)
  },

  async enrollProspect(sequenceId, prospectId) {
    return apiCall(`/sequences/${sequenceId}/enrollments`, 'POST', {
      data: {
        type: 'prospectEnrollment',
        attributes: { prospectId },
      },
    })
  },

  async getMailings(options = {}) {
    return apiCall(`/mailings?limit=${options.limit || 100}`)
  },

  async getTemplates(options = {}) {
    return apiCall(`/templates?limit=${options.limit || 100}`)
  },

  async getAccounts(options = {}) {
    return apiCall(`/accounts?limit=${options.limit || 100}`)
  },

  async createAccount(data) {
    return apiCall('/accounts', 'POST', { data: [data] })
  },

  async getOpportunities(options = {}) {
    return apiCall(`/opportunities?limit=${options.limit || 100}`)
  },
}
