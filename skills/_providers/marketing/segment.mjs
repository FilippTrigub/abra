// Segment provider

const WRITE_KEY = process.env.SEGMENT_WRITE_KEY

function checkKey() {
  if (!WRITE_KEY) {
    throw new Error('SEGMENT_WRITE_KEY environment variable required')
  }
}

function authHeader() {
  return `Basic ${Buffer.from(`${WRITE_KEY}:`).toString('base64')}`
}

async function send(endpoint, payload) {
  checkKey()
  const res = await fetch(`https://api.segment.io/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader(),
    },
    body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
  })
  return { status: res.status, success: res.ok }
}

export const Segment = {
  async identify(userId, traits = {}) {
    return send('/identify', { type: 'identify', userId, traits })
  },

  async track(userId, event, properties = {}) {
    return send('/track', { type: 'track', userId, event, properties })
  },

  async page(userId, name, properties = {}) {
    return send('/page', { type: 'page', userId, name, properties })
  },

  async group(userId, groupId, traits = {}) {
    return send('/group', { type: 'group', userId, groupId, traits })
  },

  async alias(userId, previousId) {
    return send('/alias', { type: 'alias', userId, previousId })
  },
}
