// Buffer CLI wrapper
// Wraps marketingskills/tools/clis/buffer.js functionality

const API_KEY = process.env.BUFFER_API_KEY
const BASE_URL = 'https://api.bufferapp.com/1'

function checkKey() {
  if (!API_KEY) {
    throw new Error('BUFFER_API_KEY environment variable required')
  }
}

async function api(method, path, body = null, options = {}) {
  checkKey()
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
  }
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }
  if (options.dryRun) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, body: body?.toString() }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? body.toString() : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

export const Buffer = {
  async userInfo(options = {}) {
    return api('GET', '/user.json', null, options)
  },

  async listProfiles(options = {}) {
    return api('GET', '/profiles.json', null, options)
  },

  async getProfile(profileId, options = {}) {
    return api('GET', `/profiles/${profileId}.json`, null, options)
  },

  async getSchedules(profileId, options = {}) {
    return api('GET', `/profiles/${profileId}/schedules.json`, null, options)
  },

  async listPendingUpdates(profileId, options = {}) {
    const params = new URLSearchParams()
    if (options.count) params.set('count', String(options.count))
    if (options.page) params.set('page', String(options.page))
    if (options.since) params.set('since', options.since)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return api('GET', `/profiles/${profileId}/updates/pending.json${qs}`, null, options)
  },

  async listSentUpdates(profileId, options = {}) {
    const params = new URLSearchParams()
    if (options.count) params.set('count', String(options.count))
    if (options.page) params.set('page', String(options.page))
    if (options.since) params.set('since', options.since)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return api('GET', `/profiles/${profileId}/updates/sent.json${qs}`, null, options)
  },

  async createUpdate(profileIds, text, options = {}) {
    const body = new URLSearchParams()
    body.append('text', text)
    profileIds.forEach(id => body.append('profile_ids[]', id))
    if (options.scheduledAt) body.append('scheduled_at', options.scheduledAt)
    if (options.now) body.append('now', 'true')
    if (options.top) body.append('top', 'true')
    if (options.shorten) body.append('shorten', 'true')
    if (options.media) {
      if (options.media.photo) body.append('media[photo]', options.media.photo)
      if (options.media.thumbnail) body.append('media[thumbnail]', options.media.thumbnail)
      if (options.media.link) body.append('media[link]', options.media.link)
    }
    return api('POST', '/updates/create.json', body, options)
  },

  async deleteUpdate(updateId, options = {}) {
    return api('POST', `/updates/${updateId}/destroy.json`, null, options)
  },

  async shareUpdate(updateId, options = {}) {
    return api('POST', `/updates/${updateId}/share.json`, null, options)
  },
}
