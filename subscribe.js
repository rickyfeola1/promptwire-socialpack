export default async function handler(req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, automation_id } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
    }

    const PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
    const API_KEY = process.env.BEEHIIV_API_KEY;
    const AUTOMATION_ID = automation_id || process.env.BEEHIIV_AUTOMATION_ID;

    try {
        // STEP 1 — Create subscription
        const subResponse = await fetch(
            `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    email: email,
                    reactivate_existing: true,
                    send_welcome_email: false
                })
            }
        );

        const subData = await subResponse.json();

        if (!subResponse.ok) {
            console.error('Beehiiv subscription error:', subData);
            return res.status(500).json({ error: 'Subscription failed' });
        }

        // Small delay to let Beehiiv process
        await new Promise(resolve => setTimeout(resolve, 1500));

        // STEP 2 — Enrol in automation journey
        const journeyResponse = await fetch(
            `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/automations/${AUTOMATION_ID}/journeys`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    email: email,
                    double_opt_override: 'off'
                })
            }
        );

        const journeyData = await journeyResponse.json();

        if (!journeyResponse.ok) {
            const alreadyEnrolled = journeyData?.errors?.[0]?.code?.includes('ALREADY_ENROLLED');
            if (!alreadyEnrolled) {
                console.error('Beehiiv journey error:', journeyData);
            }
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
}
