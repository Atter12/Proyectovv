export interface TikTokTokenBundle {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  refreshExpiresAt?: string | null;
  scopes: string[];
  raw?: Record<string, unknown>;
}

export interface TikTokAdvertiserAccount {
  advertiserId: string;
  name: string;
  currency?: string | null;
  timezone?: string | null;
  status?: string | null;
  raw?: Record<string, unknown>;
}

export interface TikTokIntegrationConnection {
  id: string;
  organizationId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scopes: string[];
}
