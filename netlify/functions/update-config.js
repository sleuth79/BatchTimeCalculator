const fs = require('fs').promises; // Using the promise-based API for async operations

// Helper to safely stringify objects that contain circular references
function safeStringify(obj) {
  const seen = new WeakSet();
  console.log("Starting safeStringify with object:", obj);
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        console.warn("Circular reference found at key:", key);
        return; // omits circular reference
      }
      seen.add(value);
    }
    return value;
  });
}

module.exports.handler = async (event, context) => {
  console.log("Received event:", safeStringify(event));

  if (event.httpMethod !== "POST") {
    console.log("Invalid HTTP method received:", event.httpMethod);
    return { 
      statusCode: 405, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: "Method Not Allowed" 
    };
  }
  
  console.log("Received event.body:", event.body);
  
  try {
    // Parse the incoming configuration update from event.body
    const newConfig = JSON.parse(event.body);
    console.log("Parsed new configuration:", newConfig);
    
    // Define the path to your gc-config.json file.
    // Note: In AWS Lambda or similar environments, you might only be able to write to a temporary directory (e.g. '/tmp')
    const configPath = './public/data/gc_config.json';
    
    // Write the new configuration to the file, formatting it with 2-space indentation for readability
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
    
    console.log("Configuration file updated successfully.");
    
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
    console.error("Error updating config:", error);
    return { 
      statusCode: 500, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
