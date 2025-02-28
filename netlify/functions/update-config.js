const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

module.exports.handler = async (event, context) => {
  // Handle GET requests: retrieve the configuration from Firestore
  if (event.httpMethod === "GET") {
    try {
      const doc = await db.collection('config').doc('gc_config').get();
      if (!doc.exists) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Configuration not found" }),
        };
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(doc.data()),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  // For POST requests: update the configuration in Firestore
  if (event.httpMethod === "POST") {
    try {
      const newConfig = JSON.parse(event.body);
      await db.collection('config').doc('gc_config').set(newConfig);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: true,
          message: "Configuration updated successfully",
          config: newConfig,
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: error.message }),
      };
    }
  }

  // If method is neither GET nor POST, return 405
  return { 
    statusCode: 405, 
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: "Method Not Allowed" 
  };
};
