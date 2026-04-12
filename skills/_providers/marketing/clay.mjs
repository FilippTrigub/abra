// Clay CLI wrapper

const ACCESS_TOKEN = process.env.CLAY_API_KEY

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('CLAY_API_KEY environment variable required')
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  checkKey()
  const url = `https://api.clay.com/v1${endpoint}`
  
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

export const Clay = {
  async getTables(options = {}) {
    const limit = options.limit || 50
    return apiCall(`/tables?limit=${limit}`)
  },

  async getTable(tableId) {
    return apiCall(`/tables/${tableId}`)
  },

  async getTableRows(tableId, options = {}) {
    const limit = options.limit || 100
    const page = options.page || 1
    return apiCall(`/tables/${tableId}/rows?limit=${limit}&page=${page}`)
  },

  async createTableRow(tableId, data) {
    return apiCall(`/tables/${tableId}/rows`, 'POST', data)
  },

  async updateTableRow(tableId, rowId, data) {
    return apiCall(`/tables/${tableId}/rows/${rowId}`, 'PATCH', data)
  },

  async deleteTableRow(tableId, rowId) {
    return apiCall(`/tables/${tableId}/rows/${rowId}`, 'DELETE')
  },

  async runEnrichment(tableId, rowId, provider) {
    return apiCall(`/tables/${tableId}/rows/${rowId}/enrich/${provider}`, 'POST')
  },

  async getColumns(tableId) {
    return apiCall(`/tables/${tableId}/columns`)
  },
}
