import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type ThingsBoardDevice = {
  id?: { id?: string } | string;
  name?: string;
  type?: string;
  label?: string;
  additionalInfo?: Record<string, unknown>;
};

type ThingsBoardAsset = {
  id?: { id?: string } | string;
  name?: string;
  type?: string;
  label?: string;
};

type ThingsBoardAttribute = {
  key: string;
  value: unknown;
  lastUpdateTs?: number;
};

@Injectable()
export class ThingsBoardClientService {
  private token: string | null = null;
  private tokenCreatedAt = 0;

  async login() {
    const username = process.env.THINGSBOARD_USERNAME;
    const password = process.env.THINGSBOARD_PASSWORD;
    if (!username || !password) {
      throw new ServiceUnavailableException('ThingsBoard username or password is not configured');
    }

    const cached = this.getCachedToken();
    if (cached) return cached;

    const response = await this.request<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true
    });
    this.token = response.token;
    this.tokenCreatedAt = Date.now();
    return response.token;
  }

  async getTenantDevices() {
    await this.login();
    const response = await this.request<{ data?: ThingsBoardDevice[] }>('/api/tenant/devices?pageSize=1000&page=0');
    return response.data ?? [];
  }

  async getDeviceById(thingsboardDeviceId: string) {
    await this.login();
    return this.request<ThingsBoardDevice>(`/api/device/${encodeURIComponent(thingsboardDeviceId)}`);
  }

  async getLatestTelemetry(thingsboardDeviceId: string) {
    await this.login();
    return this.request<Record<string, unknown>>(
      `/api/plugins/telemetry/DEVICE/${encodeURIComponent(thingsboardDeviceId)}/values/timeseries`
    );
  }

  async getDeviceAttributes(thingsboardDeviceId: string) {
    await this.login();
    const scopes = ['SERVER_SCOPE', 'SHARED_SCOPE', 'CLIENT_SCOPE'];
    const attributes: Record<string, unknown> = {};
    for (const scope of scopes) {
      const items = await this.requestOrEmpty<ThingsBoardAttribute[]>(
        `/api/plugins/telemetry/DEVICE/${encodeURIComponent(thingsboardDeviceId)}/values/attributes/${scope}`
      );
      for (const item of items) {
        attributes[item.key] = item.value;
      }
    }
    return attributes;
  }

  async getDeviceRelations(thingsboardDeviceId: string) {
    await this.login();
    return this.requestOrEmpty<unknown[]>(
      `/api/relations?fromId=${encodeURIComponent(thingsboardDeviceId)}&fromType=DEVICE`
    );
  }

  async getAssets() {
    await this.login();
    const response = await this.request<{ data?: ThingsBoardAsset[] }>('/api/tenant/assets?pageSize=1000&page=0');
    return response.data ?? [];
  }

  async getAssetRelations(assetId: string) {
    await this.login();
    return this.requestOrEmpty<unknown[]>(`/api/relations?fromId=${encodeURIComponent(assetId)}&fromType=ASSET`);
  }

  getDeviceId(device: ThingsBoardDevice) {
    if (typeof device.id === 'string') return device.id;
    return device.id?.id;
  }

  getAssetId(asset: ThingsBoardAsset) {
    if (typeof asset.id === 'string') return asset.id;
    return asset.id?.id;
  }

  private getCachedToken() {
    if (!this.token) return null;
    const maxAgeMs = 50 * 60 * 1000;
    return Date.now() - this.tokenCreatedAt < maxAgeMs ? this.token : null;
  }

  private async request<T>(path: string, options: RequestInit & { skipAuth?: boolean } = {}): Promise<T> {
    const baseUrl = process.env.THINGSBOARD_BASE_URL ?? process.env.THINGSBOARD_URL ?? 'http://localhost:8080';
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (!options.skipAuth) {
      const token = this.getCachedToken();
      if (token) headers.set('X-Authorization', `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    } catch {
      throw new ServiceUnavailableException('ThingsBoard is unavailable');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new BadGatewayException(`ThingsBoard request failed: ${response.status} ${text}`);
    }

    return (await response.json()) as T;
  }

  private async requestOrEmpty<T>(path: string): Promise<T> {
    try {
      return await this.request<T>(path);
    } catch (error) {
      if (error instanceof BadGatewayException) return [] as T;
      throw error;
    }
  }
}
