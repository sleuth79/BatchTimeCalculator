const express = require('express');
const cors = require('cors'); // Import CORS middleware
const fs = require('fs');
const path = require('path'); // Required for serving frontend files
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Enable CORS
app.use(express.json());

// Endpoint to fetch GC configurations
app.get('/api/gc-config', (req, res) => {
    const data = fs.readFileSync('./data/gc_config.json');
    res.json(JSON.parse(data));
});

// Serve static files from the Frontend folder
app.use(express.static(path.join(__dirname, '../Frontend')));

// Fallback route for frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// Start the server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
