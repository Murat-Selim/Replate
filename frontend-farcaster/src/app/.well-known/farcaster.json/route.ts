function withValidProperties(properties: Record<string, undefined | string | string[]>) {
    return Object.fromEntries(
        Object.entries(properties).filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value))
    );
}

export async function GET() {
    const URL = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "https://replate-farcaster.vercel.app";
    const header = process.env.NEXT_PUBLIC_FARCASTER_HEADER || "eyJmaWQiOjMzNTIwOSwidHlwZSI6ImF1dGgiLCJrZXkiOiIweDZlMmI0RDYzYUM4OTNmRWUyNGZmRTk0NzJkYjZCYzQzZjdiM0M3NjcifQ";
    const payload = process.env.NEXT_PUBLIC_FARCASTER_PAYLOAD || "eyJkb21haW4iOiJyZXBsYXRlLWZhcmNhc3Rlci52ZXJjZWwuYXBwIn0";
    const signature = process.env.NEXT_PUBLIC_FARCASTER_SIGNATURE || "/hFk2Jj2wiqxf7eR7tZgSc4ob+87Q6tl0lwi5d8lEMlCVkKGT8ix590FlZ7ziPRAuSVOcXMKrzxGmp5p8XoJyBw=";

    return Response.json({
        "accountAssociation": {
            "header": header,
            "payload": payload,
            "signature": signature
        },
        "miniapp": {
            "version": "1",
            "name": "Replate",
            "homeUrl": URL,
            "iconUrl": `${URL}/replate-logo.png`,
            "splashImageUrl": `${URL}/replate-logo.png`,
            "splashBackgroundColor": "#000000",
            "webhookUrl": `${URL}/api/webhook`,
            "subtitle": "Shop smart. Earn onchain.",
            "description": "Verify your grocery receipts on Base. Earn XP for healthy shopping, build streaks, and compete on the leaderboard.",
            "screenshotUrls": [
                `${URL}/replate-logo.png`,
                `${URL}/replate-logo.png`,
                `${URL}/replate-logo.png`
            ],
            "primaryCategory": "health-fitness",
            "tags": ["replate", "health", "food", "sustainability", "baseapp"],
            "heroImageUrl": `${URL}/replate-logo.png`,
            "tagline": "Shop smart. Earn onchain.",
            "ogTitle": "Replate - Healthy Shopping",
            "ogDescription": "Verify your grocery receipts on Base. Earn XP, build streaks, and win weekly rewards.",
            "ogImageUrl": `${URL}/replate-logo.png`,
            "noindex": true
        }
    });
}
