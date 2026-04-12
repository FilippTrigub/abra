// Tolt CLI wrapper
// Wraps marketingskills/tools/clis/tolt.js functionality

const API_KEY = process.env.TOLT_API_KEY
const BASE_URL = 'https://api.tolt.io/v1'

function checkKey() {
  if (!API_KEY) {
    throw new Error('TOLT_API_KEY environment variable required')
  }
}

async function api(method, path, body) {
  checkKey()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const Tolt = {
  /**
   * List affiliates
   */
  async listAffiliates(options = {}) {
    return api('GET', '/affiliates')
  },

  /**
   * Get a specific affiliate
   * @param {string} id - Affiliate ID
   */
  async getAffiliate(id) {
    checkKey()
    if (!id) throw new Error('Affiliate ID required')
    return api('GET', `/affiliates/${id}`)
  },

  /**
   * Create a new affiliate
   * @param {object} data - Affiliate data
   * @param {string} data.email - Email
   * @param {string} data.name - Name
   */
  async createAffiliate(data = {}) {
    checkKey()
    const body = {}
    if (data.email) body.email = data.email
    if (data.name) body.name = data.name
    return api('POST', '/affiliates', body)
  },

  /**
   * Update an affiliate
   * @param {string} id - Affiliate ID
   * @param {object} updates - Updates to apply
   * @param {number} updates.commissionRate - Commission rate
   * @param {string} updates.payoutMethod - Payout method
   * @param {string} updates.paypalEmail - PayPal email
   */
  async updateAffiliate(id, updates = {}) {
    checkKey()
    if (!id) throw new Error('id required (affiliate ID)')
    const body = {}
    if (updates.commissionRate !== undefined) body.commission_rate = Number(updates.commissionRate)
    if (updates.payoutMethod !== undefined) body.payout_method = updates.payoutMethod
    if (updates.paypalEmail !== undefined) body.paypal_email = updates.paypalEmail
    return api('PATCH', `/affiliates/${id}`, body)
  },

  /**
   * List referrals
   * @param {object} options - Additional options
   * @param {string} options.affiliateId - Filter by affiliate ID
   */
  async listReferrals(options = {}) {
    const params = new URLSearchParams()
    if (options.affiliateId) params.set('affiliate_id', options.affiliateId)
    return api('GET', `/referrals?${params}`)
  },

  /**
   * Get referrals by customer ID
   * @param {string} customerId - Customer ID
   */
  async getReferralsByCustomer(customerId) {
    checkKey()
    if (!customerId) throw new Error('customerId required')
    const params = new URLSearchParams({ customer_id: customerId })
    return api('GET', `/referrals?${params}`)
  },

  /**
   * List commissions
   * @param {object} options - Additional options
   * @param {string} options.affiliateId - Filter by affiliate ID
   */
  async listCommissions(options = {}) {
    const params = new URLSearchParams()
    if (options.affiliateId) params.set('affiliate_id', options.affiliateId)
    return api('GET', `/commissions?${params}`)
  },

  /**
   * List payouts
   * @param {object} options - Additional options
   * @param {string} options.affiliateId - Filter by affiliate ID
   */
  async listPayouts(options = {}) {
    const params = new URLSearchParams()
    if (options.affiliateId) params.set('affiliate_id', options.affiliateId)
    return api('GET', `/payouts?${params}`)
  },
}
