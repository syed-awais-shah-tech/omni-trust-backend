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

export interface CreateOrderParams {
  productName?: string;
  quantity?: number;
  amount: number | string;
  currency?: string;
}

export interface PayPalOrderResult {
  orderId: string;
  status: string;
  approvalUrl?: string;
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

/**
 * Creates a PayPal order with CAPTURE intent using the PayPal Orders v2 REST API.
 */
export async function createPayPalOrder(params: CreateOrderParams): Promise<PayPalOrderResult> {
  const { baseUrl } = paypalConfig;
  const { token } = await getPayPalAccessToken();

  const numAmount = parseFloat(String(params.amount));
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Invalid order amount. Amount must be a positive number.');
  }

  const qty =
    params.quantity && Number.isInteger(Number(params.quantity)) && Number(params.quantity) > 0
      ? Number(params.quantity)
      : 1;

  const currency = params.currency ? params.currency.trim().toUpperCase() : 'USD';
  const productName = params.productName ? params.productName.trim() : 'OmniTrust Test Product';

  const unitAmountStr = numAmount.toFixed(2);
  const totalAmountStr = (numAmount * qty).toFixed(2);

  const orderPayload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        description: productName,
        amount: {
          currency_code: currency,
          value: totalAmountStr,
          breakdown: {
            item_total: {
              currency_code: currency,
              value: totalAmountStr,
            },
          },
        },
        items: [
          {
            name: productName,
            quantity: String(qty),
            unit_amount: {
              currency_code: currency,
              value: unitAmountStr,
            },
          },
        ],
      },
    ],
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorDetails = errorData?.details?.[0]?.description || errorData?.message || response.statusText;
    throw new Error(`PayPal Order creation failed (${response.status}): ${errorDetails}`);
  }

  const orderData = (await response.json()) as any;
  const approvalUrl = orderData.links?.find((l: any) => l.rel === 'approve')?.href;

  return {
    orderId: orderData.id,
    status: orderData.status,
    approvalUrl,
  };
}

export const paypalService = {
  getAccessToken: getPayPalAccessToken,
  createOrder: createPayPalOrder,
};
