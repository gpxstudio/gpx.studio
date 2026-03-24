export default async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const params = url.searchParams.toString();
    const target = `https://brouter.gpx.studio/?${params}`;

    try {
        const response = await fetch(target);
        const data = await response.text();
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status).send(data);
    } catch (e) {
        res.status(502).json({ error: 'Failed to reach brouter' });
    }
}
