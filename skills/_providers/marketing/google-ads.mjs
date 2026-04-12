// Google Ads CLI wrapper
// Wraps marketingskills/tools/clis/google-ads.js functionality

const ACCESS_TOKEN = process.env.GOOGLE_ADS_TOKEN
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('GOOGLE_ADS_TOKEN environment variable required')
  }
}

async function api(method, path, body = null, options = {}) {
  checkKey()
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'developer-token': DEVELOPER_TOKEN || '',
    'Content-Type': 'application/json',
  }
  if (CUSTOMER_ID) {
    headers['login-customer-id'] = CUSTOMER_ID
  }
  if (options.dryRun) {
    return { _dry_run: true, method, path, body }
  }
  const res = await fetch(`https://googleads.googleapis.com/v18${path}`, {
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

export const GoogleAds = {
  async listCampaigns(options = {}) {
    return api('GET', '/googleAds:searchStream', {
      query: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign ORDER BY campaign.id`,
    }, options)
  },

  async getCampaign(campaignId, options = {}) {
    return api('POST', '/googleAds:searchStream', {
      query: `SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.id = ${campaignId}`,
    }, options)
  },

  async listAdGroups(campaignId, options = {}) {
    return api('POST', '/googleAds:searchStream', {
      query: `SELECT ad_group.id, ad_group.name, ad_group.status FROM ad_group WHERE ad_group.campaign_id = ${campaignId}`,
    }, options)
  },

  async getAds(campaignId, options = {}) {
    return api('POST', '/googleAds:searchStream', {
      query: `SELECT ad.id, ad.name, ad.ad_group_id FROM ad WHERE ad.ad_group_id IN (SELECT ad_group.id FROM ad_group WHERE ad_group.campaign_id = ${campaignId})`,
    }, options)
  },
}
