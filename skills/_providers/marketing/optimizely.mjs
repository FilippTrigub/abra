// Optimizely CLI wrapper
// Wraps marketingskills/tools/clis/optimizely.js functionality

const ACCESS_TOKEN = process.env.OPTIMIZELY_ACCESS_TOKEN
const BASE_URL = 'https://api.optimizely.com/v2'

function checkKey() {
  if (!ACCESS_TOKEN) {
    throw new Error('OPTIMIZELY_ACCESS_TOKEN environment variable required')
  }
}

async function api(method, path, body) {
  checkKey()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
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

export const Optimizely = {
  /**
   * List projects
   * @param {object} options - Additional options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.perPage - Results per page (default: 25)
   */
  async listProjects(options = {}) {
    const page = options.page || 1
    const perPage = options.perPage || 25
    return api('GET', `/projects?page=${page}&per_page=${perPage}`)
  },

  /**
   * Get a specific project
   * @param {string} id - Project ID
   */
  async getProject(id) {
    checkKey()
    if (!id) throw new Error('id required')
    return api('GET', `/projects/${id}`)
  },

  /**
   * Create a new project
   * @param {string} name - Project name
   * @param {object} options - Additional options
   * @param {string} options.platform - Platform type
   */
  async createProject(name, options = {}) {
    checkKey()
    if (!name) throw new Error('name required')
    const body = { name }
    if (options.platform) body.platform = options.platform
    return api('POST', '/projects', body)
  },

  /**
   * List experiments
   * @param {string} projectId - Project ID
   * @param {object} options - Additional options
   * @param {string} options.status - Filter by status
   * @param {number} options.page - Page number
   * @param {number} options.perPage - Results per page
   */
  async listExperiments(projectId, options = {}) {
    checkKey()
    if (!projectId) throw new Error('projectId required')
    const params = new URLSearchParams({
      project_id: projectId,
      page: options.page || 1,
      per_page: options.perPage || 25,
    })
    if (options.status) params.set('status', options.status)
    return api('GET', `/experiments?${params}`)
  },

  /**
   * Get a specific experiment
   * @param {string} id - Experiment ID
   */
  async getExperiment(id) {
    checkKey()
    if (!id) throw new Error('id required')
    return api('GET', `/experiments/${id}`)
  },

  /**
   * Create a new experiment
   * @param {string} projectId - Project ID
   * @param {string} name - Experiment name
   * @param {object} options - Additional options
   * @param {string} options.type - Experiment type (default: 'a/b')
   * @param {number} options.trafficAllocation - Traffic allocation
   */
  async createExperiment(projectId, name, options = {}) {
    checkKey()
    if (!projectId || !name) throw new Error('projectId and name required')
    const body = {
      project_id: Number(projectId),
      name,
      type: options.type || 'a/b',
      status: 'not_started',
    }
    if (options.trafficAllocation) body.traffic_allocation = Number(options.trafficAllocation)
    return api('POST', '/experiments', body)
  },

  /**
   * Update an experiment
   * @param {string} id - Experiment ID
   * @param {object} updates - Updates to apply
   * @param {string} updates.name - New name
   * @param {string} updates.status - New status
   * @param {number} updates.trafficAllocation - New traffic allocation
   */
  async updateExperiment(id, updates = {}) {
    checkKey()
    if (!id) throw new Error('id required')
    const body = {}
    if (updates.name !== undefined) body.name = updates.name
    if (updates.status !== undefined) body.status = updates.status
    if (updates.trafficAllocation !== undefined) body.traffic_allocation = Number(updates.trafficAllocation)
    return api('PATCH', `/experiments/${id}`, body)
  },

  /**
   * Get experiment results
   * @param {string} id - Experiment ID
   * @param {object} options - Additional options
   * @param {string} options.startTime - Start time filter
   * @param {string} options.endTime - End time filter
   */
  async getExperimentResults(id, options = {}) {
    checkKey()
    if (!id) throw new Error('id required')
    const params = new URLSearchParams()
    if (options.startTime) params.set('start_time', options.startTime)
    if (options.endTime) params.set('end_time', options.endTime)
    const qs = params.toString()
    return api('GET', `/experiments/${id}/results${qs ? '?' + qs : ''}`)
  },

  /**
   * Archive an experiment
   * @param {string} id - Experiment ID
   */
  async archiveExperiment(id) {
    checkKey()
    if (!id) throw new Error('id required')
    return api('PATCH', `/experiments/${id}`, { status: 'archived' })
  },

  /**
   * List campaigns
   * @param {string} projectId - Project ID
   * @param {object} options - Additional options
   * @param {number} options.page - Page number
   * @param {number} options.perPage - Results per page
   */
  async listCampaigns(projectId, options = {}) {
    checkKey()
    if (!projectId) throw new Error('projectId required')
    return api('GET', `/campaigns?project_id=${projectId}&page=${options.page || 1}&per_page=${options.perPage || 25}`)
  },

  /**
   * Get a specific campaign
   * @param {string} id - Campaign ID
   */
  async getCampaign(id) {
    checkKey()
    if (!id) throw new Error('id required')
    return api('GET', `/campaigns/${id}`)
  },

  /**
   * Get campaign results
   * @param {string} id - Campaign ID
   */
  async getCampaignResults(id) {
    checkKey()
    if (!id) throw new Error('id required')
    return api('GET', `/campaigns/${id}/results`)
  },

  /**
   * List audiences
   * @param {string} projectId - Project ID
   * @param {object} options - Additional options
   * @param {number} options.page - Page number
   * @param {number} options.perPage - Results per page
   */
  async listAudiences(projectId, options = {}) {
    checkKey()
    if (!projectId) throw new Error('projectId required')
    return api('GET', `/audiences?project_id=${projectId}&page=${options.page || 1}&per_page=${options.perPage || 25}`)
  },

  /**
   * Get a specific audience
   * @param {string} id - Audience ID
   */
  async getAudience(id) {
    checkKey()
    if (!id) throw new Error('id required')
    return api('GET', `/audiences/${id}`)
  },

  /**
   * List events
   * @param {string} projectId - Project ID
   * @param {object} options - Additional options
   * @param {number} options.page - Page number
   * @param {number} options.perPage - Results per page
   */
  async listEvents(projectId, options = {}) {
    checkKey()
    if (!projectId) throw new Error('projectId required')
    return api('GET', `/events?project_id=${projectId}&page=${options.page || 1}&per_page=${options.perPage || 25}`)
  },

  /**
   * List pages
   * @param {string} projectId - Project ID
   * @param {object} options - Additional options
   * @param {number} options.page - Page number
   * @param {number} options.perPage - Results per page
   */
  async listPages(projectId, options = {}) {
    checkKey()
    if (!projectId) throw new Error('projectId required')
    return api('GET', `/pages?project_id=${projectId}&page=${options.page || 1}&per_page=${options.perPage || 25}`)
  },
}
