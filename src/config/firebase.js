const admin = require('firebase-admin');

// You will need to provide the path to the service account key json via environment variables
// Or directly place the `serviceAccountKey.json` inside this config folder
try {
    let serviceAccount;

    // Check if base64 encoded JSON is in ENV
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const buff = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
        serviceAccount = JSON.parse(buff.toString('utf-8'));
    }
    // Fallback to local file for dev
    else {
        serviceAccount = require('./serviceAccountKey.json');
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK initialized successfully.');
    }
} catch (error) {
    console.error('Firebase Admin SDK initialization failed:', error.message);
    console.warn('⚠️ Push notifications will not send until Firebase Admin is configured properly.');
}

const sendPushNotification = async (tokens, title, body, data = {}) => {
    if (!admin.apps.length || !tokens || tokens.length === 0) {
        console.log('[FCM] Skipped: no app or no tokens');
        return;
    }

    try {
        const cleanTokens = (Array.isArray(tokens) ? tokens : [tokens]).filter(t => t && typeof t === 'string');
        if (cleanTokens.length === 0) {
            console.log('[FCM] No valid tokens after filtering');
            return;
        }

        // Ensure data values are all strings (FCM requirement)
        const stringData = {};
        for (const [k, v] of Object.entries(data)) {
            stringData[k] = String(v);
        }

        const message = {
            notification: { title, body },
            data: stringData,
            tokens: cleanTokens
        };

        console.log(`[FCM] Sending to ${cleanTokens.length} token(s)...`);
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[FCM] Success: ${response.successCount}, Failures: ${response.failureCount}`);

        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`[FCM] Token[${idx}] failed:`, resp.error?.code, resp.error?.message);
                }
            });
        }
    } catch (error) {
        console.error('[FCM] Error sending push notification:', error.code, error.message);
    }
};

module.exports = {
    admin,
    sendPushNotification
};
