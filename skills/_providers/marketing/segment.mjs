// Segment CLI wrapper

const ACCESS_TOKEN = process.env.SEGMENT_WRITE_KEY

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('SEGMENT_WRITE_KEY environment variable required')
  }
}

export const Segment = {
  async identify(userId, traits = {}) {
    return this.track(userId, 'identify', traits)
  },

  async track(userId, event, properties = {}) {
    const payload = {
      type: 'track',
      userId,
      event,
      properties,
      timestamp: new Date().toISOString(),
    }
    
    const res = await fetch('https://api.segment.io/v1/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${ACCESS_TOKEN}:`).toString('base64')}`,
      },
      body: JSON.stringify(payload),
    })
    
    return { status: res.status, success: res.ok }
  },

  async page(userId, name, properties = {}) {
    const payload = {
      type: 'page',
      userId,
      name,
      properties,
      timestamp: new Date().toISOString(),
    }
    
    const res = await fetch('https://api.segment.io/v1/page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${ACCESS_TOKEN}:`).toString('base64')}`,
      },
      body: JSON.stringify(payload),
    })
    
    return { status: res.status, success: res.ok }
  },

  async group(userId, groupId, traits = {}) {
    const payload = {
      type: 'group',
      userId,
      groupId,
      traits,
      timestamp: new Date().toISOString(),
    }
    
    const res = await fetch('https://api.segment.io/v1/group', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${ACCESS_TOKEN}:`).toString('base64')}`,
      },
      body: JSON.stringify(payload),
    })
    
    return { status: res.status, success: res.ok }
  },

  async alias(userId, previousId) {
    const payload = {
      type: 'alias',
      userId,
      previousId,
      timestamp: new Date().toISOString(),
    }
    
    const res = await fetch('https://api.segment.io/v1/alias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${ACCESS_TOKEN}:`).toString('base64')}`,
      },
      body: JSON.stringify(payload),
    })
    
    return { status: res.status, success: res.ok }
  },
}
