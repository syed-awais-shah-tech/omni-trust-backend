import express, { Application, Request, Response, NextFunction } from 'express';
import { supabase } from './supabase';
import { getPayPalAccessToken, createPayPalOrder, capturePayPalOrder } from './paypal';

const app: Application = express();

app.use(express.json());

// Enable CORS for frontend integration
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'OmniTrust backend is healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/test-supabase', async (_req: Request, res: Response) => {
  try {
    const [policiesRes, transactionsRes] = await Promise.all([
      supabase.from('policies').select('*').limit(5),
      supabase.from('transactions').select('*').limit(5)
    ]);

    if (policiesRes.error || transactionsRes.error) {
      return res.status(500).json({
        success: false,
        message: 'Supabase table query error',
        errors: {
          policies: policiesRes.error,
          transactions: transactionsRes.error
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Supabase tables read successfully',
      tables: {
        policies: {
          status: policiesRes.status,
          rowCount: policiesRes.data?.length ?? 0,
          data: policiesRes.data
        },
        transactions: {
          status: transactionsRes.status,
          rowCount: transactionsRes.data?.length ?? 0,
          data: transactionsRes.data
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to communicate with Supabase',
      error: err?.message || 'Unknown error'
    });
  }
});

// GET /api/policies - Read policy records from Supabase
app.get('/api/policies', async (_req: Request, res: Response) => {
  try {
    const { data, error, status } = await supabase
      .from('policies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(status || 500).json({
        success: false,
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      data: data ?? [],
      policies: data ?? []
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error'
    });
  }
});

// GET /api/transactions - Read transaction records from Supabase
app.get('/api/transactions', async (_req: Request, res: Response) => {
  try {
    const { data, error, status } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(status || 500).json({
        success: false,
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      data: data ?? [],
      transactions: data ?? []
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error'
    });
  }
});

// GET /api/paypal/auth/test - Test PayPal Sandbox OAuth authentication
app.get('/api/paypal/auth/test', async (_req: Request, res: Response) => {
  try {
    const authResult = await getPayPalAccessToken();

    return res.status(200).json({
      success: true,
      message: 'PayPal Sandbox authentication successful',
      tokenType: authResult.tokenType,
      expiresIn: authResult.expiresIn,
      appId: authResult.appId,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'PayPal Sandbox authentication failed',
      error: err?.message || 'Unknown authentication error',
    });
  }
});

// POST /api/paypal/orders - Create a PayPal Sandbox order
app.post('/api/paypal/orders', async (req: Request, res: Response) => {
  try {
    const { productName, product_name, quantity, amount, currency } = req.body || {};

    // Basic validation
    if (amount === undefined || amount === null || amount === '') {
      return res.status(400).json({
        success: false,
        error: 'Validation error: amount is required',
      });
    }

    const numAmount = parseFloat(String(amount));
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error: amount must be a positive number',
      });
    }

    const qty = quantity !== undefined ? parseInt(String(quantity), 10) : 1;
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error: quantity must be a positive integer',
      });
    }

    const curr = currency ? String(currency).trim().toUpperCase() : 'USD';
    if (curr.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'Validation error: currency must be a valid 3-letter currency code (e.g. USD)',
      });
    }

    const name = productName || product_name || 'OmniTrust Test Product';

    const order = await createPayPalOrder({
      productName: name,
      quantity: qty,
      amount: numAmount,
      currency: curr,
    });

    return res.status(201).json({
      success: true,
      message: 'PayPal order created successfully',
      orderId: order.orderId,
      status: order.status,
      approvalUrl: order.approvalUrl,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create PayPal order',
      error: err?.message || 'Unknown error occurred while creating order',
    });
  }
});

// POST /api/paypal/orders/:orderId/capture - Capture an approved PayPal Sandbox order
app.post('/api/paypal/orders/:orderId/capture', async (req: Request, res: Response) => {
  try {
    const rawOrderId = req.params.orderId;
    const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Validation error: orderId is required',
      });
    }

    const capture = await capturePayPalOrder(orderId);

    return res.status(200).json({
      success: true,
      message: 'PayPal order captured successfully',
      orderId: capture.orderId,
      status: capture.status,
      captureId: capture.captureId,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to capture PayPal order',
      error: err?.message || 'Unknown error occurred while capturing order',
    });
  }
});

export default app;
