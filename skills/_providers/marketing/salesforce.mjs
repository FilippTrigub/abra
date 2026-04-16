// Salesforce provider
// Uses OAuth2 password grant to obtain access token + instance URL at request time

const CLIENT_ID = process.env.SALESFORCE_CLIENT_ID
const CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET
const USERNAME = process.env.SALESFORCE_USERNAME
const PASSWORD = process.env.SALESFORCE_PASSWORD
const SECURITY_TOKEN = process.env.SALESFORCE_SECURITY_TOKEN || ''

const TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token'
const API_VERSION = 'v58.0'

function checkKeys() {
  if (!CLIENT_ID || !CLIENT_SECRET || !USERNAME || !PASSWORD) {
    throw new Error('SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_USERNAME, and SALESFORCE_PASSWORD environment variables required')
  }
}

async function getAuth() {
  checkKeys()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: USERNAME,
      // Salesforce password grant requires password + security token concatenated
      password: PASSWORD + SECURITY_TOKEN,
    }),
  })
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`Failed to obtain Salesforce access token: ${data.error_description || data.error || 'unknown error'}`)
  }
  return { accessToken: data.access_token, instanceUrl: data.instance_url }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const { accessToken, instanceUrl } = await getAuth()
  const res = await fetch(`${instanceUrl}/services/data/${API_VERSION}${endpoint}`, {
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

export const Salesforce = {
  async query(soql) {
    return apiCall(`/query?q=${encodeURIComponent(soql)}`)
  },

  async getContacts(options = {}) {
    const limit = options.limit || 100
    return this.query(`SELECT Id, Name, Email, Phone, Title, Account.Name FROM Contact LIMIT ${limit}`)
  },

  async getLeads(options = {}) {
    const limit = options.limit || 100
    return this.query(`SELECT Id, Name, Email, Phone, Title, Company, Status FROM Lead LIMIT ${limit}`)
  },

  async getOpportunities(options = {}) {
    const limit = options.limit || 100
    return this.query(`SELECT Id, Name, Amount, StageName, CloseDate, Account.Name FROM Opportunity LIMIT ${limit}`)
  },

  async getAccounts(options = {}) {
    const limit = options.limit || 100
    return this.query(`SELECT Id, Name, Type, Industry, AnnualRevenue FROM Account LIMIT ${limit}`)
  },

  async createRecord(objectType, fields) {
    return apiCall(`/sobjects/${objectType}`, 'POST', fields)
  },

  async updateRecord(objectType, id, fields) {
    return apiCall(`/sobjects/${objectType}/${id}`, 'PATCH', fields)
  },

  async deleteRecord(objectType, id) {
    return apiCall(`/sobjects/${objectType}/${id}`, 'DELETE')
  },

  async getDescribe(objectType) {
    return apiCall(`/sobjects/${objectType}/describe`)
  },
}
