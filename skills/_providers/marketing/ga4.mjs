// GA4 CLI wrapper
// Wraps marketingskills/tools/clis/ga4.js functionality

const ACCESS_TOKEN = process.env.GA4_ACCESS_TOKEN
const PROPERTY_ID = process.env.GA4_PROPERTY_ID

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('GA4_ACCESS_TOKEN environment variable required')
  }
}

async function runReport(body, options = {}) {
  checkKey()
  if (!PROPERTY_ID) {
    throw new Error('GA4_PROPERTY_ID environment variable required')
  }
  if (options.dryRun) {
    return { _dry_run: true, body }
  }
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
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
  async runReport(reportBody, options = {}) {
    return runReport(reportBody, options)
  },

  async report(dimensions = [], metrics = [], options = {}) {
    const body = {
      dimensions: dimensions.map(d => ({ name: d })),
      metrics: metrics.map(m => ({ name: m })),
      ...options,
    }
    return runReport(body, options)
  },

  async realtimeReport(metrics = [], options = {}) {
    const body = {
      metrics: metrics.map(m => ({ name: m })),
      limit: options.limit || 10000,
    }
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runRealtimeReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
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
  },
}
