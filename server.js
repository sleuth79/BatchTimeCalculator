const express = require('express');
const app = express();
const path = require('path');

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Endpoint to serve the GC config
app.get('/gcConfig.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'gcConfig.json'));
});

// Start the server
app.listen(3000, () => {
    console.log('Static backend is running at http://localhost:3000');
});
