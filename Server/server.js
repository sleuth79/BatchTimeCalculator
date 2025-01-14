const express = require('express');
const cors = require('cors'); // Import CORS middleware
const fs = require('fs');
const path = require('path'); // Required for serving frontend files
const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Endpoint to fetch GC configurations
app.get('/api/gc-config', (req, res) => {
    const dataPath = path.join(__dirname, 'data', 'gc_config.json'); 

    try {
        const data = fs.readFileSync(dataPath, 'utf8'); 
        res.json(JSON.parse(data)); // Parse and send JSON response 
    } catch (error) {
        console.error('Error reading gc_config.json:', error.message);
        res.status(500).json({ error: 'Failed to read configuration file' }); 
    }
});

// Serve static files from the Frontend folder
app.use(express.static(path.join(__dirname, '../Frontend')));

// Fallback route to serve the frontend's index.html for SPAs
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// Start the server and bind it to 0.0.0.0
app.listen(PORT, '0.0.0.0', () => console.log(`Server running at http://localhost:${PORT}`));

