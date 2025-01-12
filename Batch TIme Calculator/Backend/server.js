const express = require('express');
const cors = require('cors'); // Import CORS middleware
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(cors()); // Enable CORS
app.use(express.json());

// Endpoint to fetch GC configurations
app.get('/api/gc-config', (req, res) => {
    const data = fs.readFileSync('./data/gc_config.json');
    res.json(JSON.parse(data));
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

