// Google Ads API provider
// Uses OAuth2 refresh token flow to obtain fresh access tokens at request time

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID  // optional: manager account ID

const BASE_URL = 'https://googleads.googleapis.com/v18'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

function checkKeys() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_REFRESH_TOKEN environment variables required')
  }
  if (!DEVELOPER_TOKEN) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN environment variable required')
  }
  if (!CUSTOMER_ID) {
    throw new Error('GOOGLE_ADS_CUSTOMER_ID environment variable required')
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

async function api(method, path, body = null) {
  checkKeys()
  const accessToken = await getAccessToken()
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  }
  if (LOGIN_CUSTOMER_ID) {
    headers['login-customer-id'] = LOGIN_CUSTOMER_ID
  }
  const res = await fetch(`${BASE_URL}/customers/${CUSTOMER_ID}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

async function gaql(query) {
  return api('POST', '/googleAds:searchStream', { query })
}

export const GoogleAds = {
  async listCampaigns() {
    return gaql('SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign ORDER BY campaign.id')
  },

  async getCampaign(campaignId) {
    return gaql(`SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.id = ${campaignId}`)
  },

  async listAdGroups(campaignId) {
    return gaql(`SELECT ad_group.id, ad_group.name, ad_group.status FROM ad_group WHERE ad_group.campaign_id = ${campaignId}`)
  },

  async getAds(campaignId) {
    return gaql(`SELECT ad.id, ad.name, ad.ad_group_id FROM ad WHERE ad.ad_group_id IN (SELECT ad_group.id FROM ad_group WHERE ad_group.campaign_id = ${campaignId})`)
  },
}
