const crypto = require('crypto');
const https = require('https');

const secret = '0wTIRRh5LUVYl5A';
const eventName = 'proxy.maintenance_window.cancelled';
// Use a new unique event ID for the cancellation event itself
const eventId = 'evt_verify_cancel_' + Date.now();
const url = 'https://vip.ibf.qzz.io/api/outservice/cheapwebhook';

// Using the IDs from the PREVIOUS message as requested ("cancel the message just now")
const payload = {
    "proxyId": 1410379,
    "maintenanceWindowId": "01985631-312c-7072-90e1-a8b90bdf1f74"
};

const body = JSON.stringify(payload);

// Calculate signature
// algo + eventName + eventId + body + secret
const input = 'sha256' + eventName + eventId + body + secret;
const signatureHash = crypto.createHmac('sha256', secret)
    .update(input)
    .digest('hex');
const signature = `sha256=${signatureHash}`;

console.log('Sending Webhook Cancellation Request:');
console.log('URL:', url);
console.log('Event:', eventName);
console.log('ID:', eventId);
console.log('Signature:', signature);
console.log('Body:', body);

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Webhook-Event': eventName,
        'Webhook-Id': eventId,
        'Webhook-Signature': signature
    }
};

const req = https.request(url, options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(body);
req.end();
