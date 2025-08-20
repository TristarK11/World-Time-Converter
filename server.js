import express from 'express';
const app = express();
const port = 8080;

app.get('/api/whereami', (req, res) => {
    res.json({ country: "Kenya", city: "Nairobi", timezone: "Africa/Nairobi" });
});

// New endpoint for timezones
app.get('/api/timezones', (req, res) => {
    const query = req.query.q || '';
    const timezones = [
        { city: "Nairobi", timezone: "Africa/Nairobi" },
        { city: "Kigali", timezone: "Africa/Kigali" },
        { city: "Kigoma", timezone: "Africa/Dar_es_Salaam" }
    ];
    const results = timezones.filter(tz => tz.city.toLowerCase().startsWith(query.toLowerCase()));
    res.json(results);
});

app.get('/', (req, res) => res.send('Server is running'));

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
