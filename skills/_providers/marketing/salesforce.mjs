// Salesforce CLI wrapper

const ACCESS_TOKEN = process.env.SALESFORCE_ACCESS_TOKEN
const INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('SALESFORCE_ACCESS_TOKEN environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKey()
  const baseUrl = INSTANCE_URL || 'https://na1.salesforce.com'
  const url = `${baseUrl}/services/data/v58.0${endpoint}`
  
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

export const Salesforce = {
  async query(soql) {
    const encoded = encodeURIComponent(soql)
    return apiCall(`/query?q=${encoded}`)
  },

  async getContacts(options = {}) {
    const limit = options.limit || 100
    return apiQuery(`SELECT Id, Name, Email, Phone, Title, Account.Name FROM Contact LIMIT ${limit}`)
  },

  async getLeads(options = {}) {
    const limit = options.limit || 100
    return apiQuery(`SELECT Id, Name, Email, Phone, Title, Company, Status FROM Lead LIMIT ${limit}`)
  },

  async getOpportunities(options = {}) {
    const limit = options.limit || 100
    return apiQuery(`SELECT Id, Name, Amount, StageName, CloseDate, Account.Name FROM Opportunity LIMIT ${limit}`)
  },

  async getAccounts(options = {}) {
    const limit = options.limit || 100
    return apiQuery(`SELECT Id, Name, Type, Industry, AnnualRevenue FROM Account LIMIT ${limit}`)
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

async function apiQuery(soql) {
  return Salesforce.query(soql)
}
