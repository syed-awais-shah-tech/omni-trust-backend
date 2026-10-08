import dotenv from 'dotenv';

dotenv.config();

export const paypalConfig = {
  clientId: process.env.PAYPAL_CLIENT_ID || '',
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  baseUrl: process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com',
};

export interface PayPalAuthResponse {
  scope?: string;
  access_token: string;
  token_type: string;
  app_id?: string;
  expires_in: number;
  nonce?: string;
}

export interface PayPalTokenResult {
  token: string;
  tokenType: string;
  expiresIn: number;
  appId?: string;
}

/**
 * Requests an OAuth2 access token from PayPal Sandbox using the client credentials flow.
 * Note: Never expose the returned access token or client secret to the frontend.
 */
export async function getPayPalAccessToken(): Promise<PayPalTokenResult> {
  const { clientId, clientSecret, baseUrl } = paypalConfig;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials missing: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured in environment variables.');
  }

  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en_US',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorDescription = errorData?.error_description || errorData?.message || response.statusText;
    throw new Error(`PayPal OAuth authentication failed (${response.status}): ${errorDescription}`);
  }

  const data = (await response.json()) as PayPalAuthResponse;

  return {
    token: data.access_token,
    tokenType: data.token_type || 'Bearer',
    expiresIn: data.expires_in,
    appId: data.app_id,
  };
}

export const paypalService = {
  getAccessToken: getPayPalAccessToken,
};
