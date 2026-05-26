const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const TELLER_APP_ID = process.env.TELLER_APP_ID;
const TELLER_CERT = process.env.TELLER_CERT;
const TELLER_KEY = process.env.TELLER_KEY;

let tlsAgent = null;
try {
  tlsAgent = new https.Agent({
    cert: TELLER_CERT,
    key: TELLER_KEY,
  });
} catch(e) {
  console.error('TLS agent error:', e.message);
}

let enrollmentData = null;

app.get('/health', (req, res) => res.json({ status: 'ok', app_id: TELLER_APP_ID }));

app.post('/teller/enrollment', (req, res) => {
  enrollmentData = req.body;
  console.log('Enrollment received:', JSON.stringify(enrollmentData));
  res.json({ success: true });
});

app.get('/teller/accounts', async (req, res) => {
  if (!enrollmentData || !enrollmentData.accessToken) {
    return res.status(400).json({ error: 'No enrollment yet. Connect your bank first.' });
  }
  try {
    const response = await fetch('https://api.teller.io/accounts', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(enrollmentData.accessToken + ':').toString('base64'),
      },
      agent: tlsAgent,
    });
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/teller/transactions', async (req, res) => {
  if (!enrollmentData || !enrollmentData.accessToken) {
    return res.status(400).json({ error: 'No enrollment yet. Connect your bank first.' });
  }
  try {
    const accountsRes = await fetch('https://api.teller.io/accounts', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(enrollmentData.accessToken + ':').toString('base64'),
      },
      agent: tlsAgent,
    });
    const accounts = await accountsRes.json();
    let allTransactions = [];
    for (const account of accounts) {
      try {
        const txRes = await fetch(`https://api.teller.io/accounts/${account.id}/transactions`, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(enrollmentData.accessToken + ':').toString('base64'),
          },
          agent: tlsAgent,
        });
        const txs = await txRes.json();
        if (Array.isArray(txs)) {
          allTransactions = allTransactions.concat(txs.map(t => ({...t, account_name: account.name})));
        }
      } catch(e) {
        console.error('Error fetching transactions for account', account.id, e.message);
      }
    }
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ transactions: allTransactions });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Teller server running on port ${PORT}`));
