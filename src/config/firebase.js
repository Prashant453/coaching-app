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
    if (!admin.apps.length || !tokens || tokens.length === 0) return;

    try {
        const message = {
            notification: {
                title,
                body
            },
            data,
            tokens: Array.isArray(tokens) ? tokens.filter(t => t) : [tokens].filter(t => t)
        };

        if (message.tokens.length > 0) {
            const response = await admin.messaging().sendMulticast(message);
            console.log(response.successCount + ' messages were sent successfully');
            if (response.failureCount > 0) {
                console.error(response.failureCount + ' messages failed.');
            }
        }
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
};

module.exports = {
    admin,
    sendPushNotification
};
