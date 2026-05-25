const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const app = express();
app.use(cors());
app.use(express.json());

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);
let accessToken = null;

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/create_link_token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'dashboard-user' },
      client_name: 'My Dashboard',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/exchange_token', async (req, res) => {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: req.body.public_token,
    });
    accessToken = response.data.access_token;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/transactions', async (req, res) => {
  if (!accessToken) return res.status(400).json({ error: 'Not connected' });
  try {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 30);
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: start.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    });
    res.json({ transactions: response.data.transactions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
