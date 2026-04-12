// Rewardful CLI wrapper
// Wraps marketingskills/tools/clis/rewardful.js functionality

const API_KEY = process.env.REWARDFUL_API_KEY
const BASE_URL = 'https://api.getrewardful.com/v1'

function checkKey() {
  if (!API_KEY) {
    throw new Error('REWARDFUL_API_KEY environment variable required')
  }
}

async function api(method, path, body) {
  checkKey()
  const auth = 'Basic ' + Buffer.from(`${API_KEY}:`).toString('base64')
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': auth,
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

export const Rewardful = {
  /**
   * List affiliates
   * @param {object} options - Additional options
   * @param {string} options.page - Page number
   */
  async listAffiliates(options = {}) {
    const params = new URLSearchParams()
    if (options.page) params.set('page', options.page)
    return api('GET', `/affiliates?${params}`)
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
   * Search affiliates by email
   * @param {string} email - Email to search for
   */
  async searchAffiliates(email) {
    checkKey()
    if (!email) throw new Error('email required')
    const params = new URLSearchParams({ email })
    return api('GET', `/affiliates?${params}`)
  },

  /**
   * Update an affiliate
   * @param {string} id - Affiliate ID
   * @param {object} updates - Updates to apply
   * @param {string} updates.firstName - First name
   * @param {string} updates.lastName - Last name
   * @param {string} updates.paypalEmail - PayPal email
   */
  async updateAffiliate(id, updates = {}) {
    checkKey()
    if (!id) throw new Error('Affiliate ID required')
    const body = {}
    if (updates.firstName !== undefined) body.first_name = updates.firstName
    if (updates.lastName !== undefined) body.last_name = updates.lastName
    if (updates.paypalEmail !== undefined) body.paypal_email = updates.paypalEmail
    return api('PUT', `/affiliates/${id}`, body)
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
   * Get referrals by Stripe customer ID
   * @param {string} stripeCustomerId - Stripe customer ID
   */
  async getReferralsByCustomer(stripeCustomerId) {
    checkKey()
    if (!stripeCustomerId) throw new Error('stripeCustomerId required')
    const params = new URLSearchParams({ stripe_customer_id: stripeCustomerId })
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
   * Get a specific commission
   * @param {string} id - Commission ID
   */
  async getCommission(id) {
    checkKey()
    if (!id) throw new Error('Commission ID required')
    return api('GET', `/commissions/${id}`)
  },

  /**
   * Create a new link
   * @param {string} affiliateId - Affiliate ID
   * @param {object} options - Additional options
   * @param {string} options.token - Link token
   * @param {string} options.url - Target URL
   */
  async createLink(affiliateId, options = {}) {
    checkKey()
    if (!affiliateId) throw new Error('affiliateId required')
    const body = {}
    if (options.token) body.token = options.token
    if (options.url) body.url = options.url
    return api('POST', `/affiliates/${affiliateId}/links`, body)
  },
}
