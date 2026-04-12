// Crossbeam CLI wrapper

const ACCESS_TOKEN = process.env.CROSSBEAM_API_KEY

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('CROSSBEAM_API_KEY environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKey()
  const url = `https://api.crossbeam.com/v1${endpoint}`
  
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

export const Crossbeam = {
  async getAccounts(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/accounts?limit=${limit}`)
  },

  async getAccount(accountId) {
    return apiCall(`/accounts/${accountId}`)
  },

  async getPartners(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/partners?limit=${limit}`)
  },

  async getPartner(partnerId) {
    return apiCall(`/partners/${partnerId}`)
  },

  async getCoSellDeals(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/cosell-deals?limit=${limit}`)
  },

  async createCoSellDeal(data) {
    return apiCall('/cosell-deals', 'POST', data)
  },

  async updateCoSellDeal(dealId, data) {
    return apiCall(`/cosell-deals/${dealId}`, 'PATCH', data)
  },

  async getActivities(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/activities?limit=${limit}`)
  },

  async getABMAccounts(options = {}) {
    const limit = options.limit || 100
    return apiCall(`/abm/accounts?limit=${limit}`)
  },
}
