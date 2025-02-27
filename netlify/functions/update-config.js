const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

module.exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
      body: "Method Not Allowed" 
    };
  }
  
  try {
    const newConfig = JSON.parse(event.body);
    // Write the new configuration to Firestore in the "config" collection, document "gc_config"
    await db.collection('config').doc('gc_config').set(newConfig);
    
    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
      body: JSON.stringify({
        success: true,
        message: "Configuration updated successfully",
        config: newConfig,
      }),
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      headers: { 
        "Content-Type": "application/json", 
        "Access-Control-Allow-Origin": "*" 
      },
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
