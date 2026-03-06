function withValidProperties(properties: Record<string, undefined | string | string[]>) {
    return Object.fromEntries(
        Object.entries(properties).filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value))
    );
}

export async function GET() {
    const URL = process.env.NEXT_PUBLIC_URL as string;
    return Response.json({
        "accountAssociation": {  // these will be added in step 5
            "header": "",
            "payload": "",
            "signature": ""
        },
        "miniapp": {
            "version": "1",
            "name": "Replate",
            "homeUrl": "https://replate61.vercel.app",
            "iconUrl": "https://replate61.vercel.app/replate-logo.png",
            "splashImageUrl": "https://replate61.vercel.app/replate-logo.png",
            "splashBackgroundColor": "#000000",
            "webhookUrl": "https://replate61.vercel.app/api/webhook",
            "subtitle": "Shop smart. Nourish well. Earn onchain.",
            "description": "Verify your grocery receipts on Base. Earn XP for healthy shopping, build streaks, and compete on the leaderboard.",
            "screenshotUrls": [
                "https://replate61.vercel.app/replate-logo.png",
                "https://replate61.vercel.app/replate-logo.png",
                "https://replate61.vercel.app/replate-logo.png"
            ],
            "primaryCategory": "health",
            "tags": ["replate", "health", "food", "sustainability", "baseapp", "miniapp"],
            "heroImageUrl": "https://replate61.vercel.app/replate-logo.png",
            "tagline": "Shop smart. Nourish well. Earn onchain.",
            "ogTitle": "Replate — Earn onchain for healthy shopping",
            "ogDescription": "Verify your grocery receipts on Base. Earn XP, build streaks, and win weekly rewards.",
            "ogImageUrl": "https://replate61.vercel.app/replate-logo.png",
            "noindex": true
        }
    }); // see the next step for the manifest_json_object
}