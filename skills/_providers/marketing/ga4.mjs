// Google Analytics 4 provider
// Uses OAuth2 refresh token flow to obtain fresh access tokens at request time

const CLIENT_ID = process.env.GA4_CLIENT_ID
const CLIENT_SECRET = process.env.GA4_CLIENT_SECRET
const REFRESH_TOKEN = process.env.GA4_REFRESH_TOKEN
const PROPERTY_ID = process.env.GA4_PROPERTY_ID

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const BASE_URL = 'https://analyticsdata.googleapis.com/v1beta'

function checkKeys() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('GA4_CLIENT_ID, GA4_CLIENT_SECRET, and GA4_REFRESH_TOKEN environment variables required')
  }
  if (!PROPERTY_ID) {
    throw new Error('GA4_PROPERTY_ID environment variable required')
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
    throw new Error(`Failed to obtain access token: ${data.error_description || data.error || 'unknown error'}`)
  }
  return data.access_token
}

async function post(path, body) {
  checkKeys()
  const accessToken = await getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const GA4 = {
  async runReport(reportBody) {
    return post(`/properties/${PROPERTY_ID}:runReport`, reportBody)
  },

  async report(dimensions = [], metrics = [], dateRanges = [{ startDate: '30daysAgo', endDate: 'today' }]) {
    return post(`/properties/${PROPERTY_ID}:runReport`, {
      dimensions: dimensions.map(d => ({ name: d })),
      metrics: metrics.map(m => ({ name: m })),
      dateRanges,
    })
  },

  async realtimeReport(metrics = []) {
    return post(`/properties/${PROPERTY_ID}:runRealtimeReport`, {
      metrics: metrics.map(m => ({ name: m })),
    })
  },
}
