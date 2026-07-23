import {
  SmartCloudClientOptions,
  SecretValue,
  Project,
  FetchSecretResponse,
  FetchAllSecretsResponse,
  ProjectsResponse,
  LoginResponse,
} from './types'
import {
  SmartCloudError,
  AuthenticationError,
  SecretNotFoundError,
  NetworkError,
} from './errors'

export class SmartCloudClient {
  private baseUrl: string
  private accessToken: string | null
  private email: string | null
  private password: string | null

  constructor(options: SmartCloudClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.accessToken = options.accessToken ?? null
    this.email = options.email ?? null
    this.password = options.password ?? null

    if (!this.accessToken && !(this.email && this.password)) {
      throw new SmartCloudError(
        'Provide either accessToken or email+password',
        400
      )
    }
  }

  /** Authenticate with email/password and store the access token. */
  async login(): Promise<string> {
    if (!this.email || !this.password) {
      throw new AuthenticationError('No credentials provided for login')
    }

    const res = await this.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: this.email, password: this.password }),
      skipAuth: true,
    })

    const data = (await res.json()) as LoginResponse
    this.accessToken = data.session.access_token
    return this.accessToken
  }

  /** Fetch a single secret's plaintext value. */
  async getSecret(projectId: string, keyName: string): Promise<string> {
    const meta = await this.getSecretWithMetadata(projectId, keyName)
    return meta.value
  }

  /** Fetch a single secret with full metadata. */
  async getSecretWithMetadata(
    projectId: string,
    keyName: string
  ): Promise<SecretValue> {
    const res = await this.fetch('/api/secrets/fetch', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, key_name: keyName }),
    })

    if (res.status === 404) {
      throw new SecretNotFoundError(keyName)
    }

    return (await res.json()) as FetchSecretResponse
  }

  /** Fetch all secrets for a project as a key-value map. */
  async getSecrets(projectId: string): Promise<Record<string, string>> {
    const res = await this.fetch('/api/secrets/fetch-all', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    })

    const data = (await res.json()) as FetchAllSecretsResponse
    const map: Record<string, string> = {}
    for (const s of data.secrets) {
      map[s.key_name] = s.value
    }
    return map
  }

  /**
   * Fetch the current active key from a key pool. The pool serves one key at a
   * time and rotates among its members; this always returns a valid key.
   */
  async getPoolKey(projectId: string, poolName: string): Promise<string> {
    const res = await this.fetch('/api/pools/fetch', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, name: poolName }),
    })
    const data = (await res.json()) as { value: string }
    return data.value
  }

  /** List all projects for the authenticated user. */
  async listProjects(): Promise<Project[]> {
    const res = await this.fetch('/api/projects', { method: 'GET' })
    const data = (await res.json()) as ProjectsResponse
    return data.projects
  }

  // ── internal ───────────────────────────────────────────────

  private async fetch(
    path: string,
    options: {
      method: string
      body?: string
      skipAuth?: boolean
    }
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (!options.skipAuth) {
      await this.ensureToken()
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    let res: Response
    try {
      res = await globalThis.fetch(url, {
        method: options.method,
        headers,
        body: options.body,
        ...{ cache: 'no-store' },
      } as RequestInit)
    } catch (err) {
      throw new NetworkError(
        `Failed to connect to ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Auto-retry once on 401 if we have credentials
    if (res.status === 401 && !options.skipAuth && this.email && this.password) {
      await this.login()
      headers['Authorization'] = `Bearer ${this.accessToken}`
      try {
        res = await globalThis.fetch(url, {
          method: options.method,
          headers,
          body: options.body,
        })
      } catch (err) {
        throw new NetworkError(
          `Failed to connect to ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    if (res.status === 401) {
      const body = await res.json().catch(() => ({ error: 'Authentication failed' }))
      throw new AuthenticationError(
        (body as { error?: string }).error ?? 'Authentication failed'
      )
    }

    if (!res.ok && res.status !== 404) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new SmartCloudError(
        (body as { error?: string }).error ?? `HTTP ${res.status}`,
        res.status
      )
    }

    return res
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken) return
    if (this.email && this.password) {
      await this.login()
      return
    }
    throw new AuthenticationError('No access token or credentials available')
  }
}
