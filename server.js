const express = require('express');
const path = require('path');
// const https = require('https');
// const fs = require('fs');
const app = express();
const port = process.env.PORT || 4000;

// Load certificates for HTTPS
// const options = {
//     key: fs.readFileSync(path.join(__dirname, 'server.key')),
//     cert: fs.readFileSync(path.join(__dirname, 'server.cert'))
// };

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected SSE clients
let clients = [];
// Store history of webhooks
let webhooks = [];

// Custom Authentication configuration
const AUTH_HEADER_KEY = 'x-webhook-auth';
const AUTH_HEADER_VALUE = 'secret-token';

// Webhook challenge verification endpoint (GET)
app.get('/webhook', (req, res) => {
    // The typical webhook challenge verification pattern usually echoes back a 'challenge' query parameter
    const challenge = req.query.challenge;
    
    // You can optionally add authentication check here if your sender includes it during verification
    const authHeader = req.headers[AUTH_HEADER_KEY] || req.headers[AUTH_HEADER_KEY.toLowerCase()];
    if (authHeader !== AUTH_HEADER_VALUE) {
        console.log(`[Reject] Verification challenge rejected. Missing or invalid auth header.`);
        return res.status(401).json({ error: 'Unauthorized', message: `Expected valid ${AUTH_HEADER_KEY} header` });
    }

    if (challenge) {
        console.log(`[Success] Verified webhook endpoint challenge: ${challenge}`);
        // Often expected to return the exact challenge string as the response body
        res.status(200).send(challenge);
    } else {
        console.log(`[Warning] GET request to /webhook without a challenge parameter.`);
        res.status(400).send('Expected challenge query parameter for validation');
    }
});

app.post('/webhook', (req, res) => {
    // Check Custom Authentication Header
    const authHeader = req.headers[AUTH_HEADER_KEY] || req.headers[AUTH_HEADER_KEY.toLowerCase()];
    
    if (authHeader !== AUTH_HEADER_VALUE) {
        console.log(`[Reject] Webhook rejected. Missing or invalid auth header.`);
        return res.status(401).json({ error: 'Unauthorized', message: `Expected valid ${AUTH_HEADER_KEY} header` });
    }

    const eventData = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        headers: req.headers,
        body: req.body,
        method: req.method,
        query: req.query
    };

    // Keep only the last 50 hooks
    webhooks.unshift(eventData);
    if (webhooks.length > 50) {
        webhooks.pop();
    }

    console.log(`[Success] Received Authorized Webhook at ${eventData.date}`);

    // Broadcast to connected SSE clients
    clients.forEach(client => client.res.write(`data: ${JSON.stringify(eventData)}\n\n`));

    res.status(200).json({ success: true, message: 'Webhook received successfully' });
});

// Endpoint to fetch existing hooks on page load
app.get('/api/webhooks', (req, res) => {
    res.json(webhooks);
});

// SSE Endpoint for real-time updates
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add this client
    const clientId = Date.now();
    clients.push({ id: clientId, res });

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
    });
});

// https.createServer(options, app).listen(port, () => {
//     console.log(`\n🚀 Webhook Listener UI running at https://localhost:${port}`);
//     console.log(`📡 URL to test webhooks: GET/POST https://localhost:${port}/webhook`);
//     console.log(`🔐 Required Header: ${AUTH_HEADER_KEY}: ${AUTH_HEADER_VALUE}`);
//     console.log(`⚠️  Note: Since this is a self-signed certificate, you may need to bypass the security warning in your browser, and configure your webhook sender to ignore SSL errors.\n`);
// });

app.listen(port, () => {
    console.log(`\n🚀 Webhook Listener UI running at http://localhost:${port}`);
    console.log(`📡 URL to test webhooks: GET/POST http://localhost:${port}/webhook`);
    console.log(`🔐 Required Header: ${AUTH_HEADER_KEY}: ${AUTH_HEADER_VALUE}\n`);
});