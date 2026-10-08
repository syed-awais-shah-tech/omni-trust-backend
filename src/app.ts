import express, { Application, Request, Response, NextFunction } from 'express';
import { supabase } from './supabase';
import { getPayPalAccessToken } from './paypal';

const app: Application = express();

app.use(express.json());

// Enable CORS for frontend integration
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

export default app;
