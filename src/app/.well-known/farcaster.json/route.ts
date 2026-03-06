function withValidProperties(properties: Record<string, undefined | string | string[]>) {
    return Object.fromEntries(
        Object.entries(properties).filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value))
    );
}

export async function GET() {
    const URL = process.env.NEXT_PUBLIC_URL as string;
    return Response.json({
        "accountAssociation": {
            "header": "eyJmaWQiOi0xLCJ0eXBlIjoiYXV0aCIsImtleSI6IjB4MzM3Q2IxNzVCNDE1Njg3MjU5ZUQ1MEU2QzI2QjI3MEYzRENCODI1OCJ9",
            "payload": "eyJkb21haW4iOiJyZXBsYXRlNjEudmVyY2VsLmFwcCJ9",
            "signature": "AAAAAAAAAAAAAAAAyhG94Fl3s2MRZwKIYr4qFzl2yhEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiSCrVbLAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAul7REO_bo9AFv8iC11NYrLu4WEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASQ_-6NvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAqwmpcFNIos6MbITAcHlWCPv5mmcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAPhSELIcxQMC9He6VmhtIBncm2etAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBNHHF2rAp9kk6-sDBwRtHgYMPKZxvdoZ3yQNl9fLVffI2psD7iIbBTQy5Pe64nYpbM9ulV5Re4cp_CPuA-8wbgRwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZJJkkmSSZJJkkmSSZJJkkmSSZJJkkmSSZJJkkmSSZJI"
        },
        "miniapp": {
            "version": "1",
            "name": "Replate",
            "homeUrl": "https://replate61.vercel.app",
            "iconUrl": "https://replate61.vercel.app/replate-logo.png",
            "splashImageUrl": "https://replate61.vercel.app/replate-logo.png",
            "splashBackgroundColor": "#000000",
            "webhookUrl": "https://replate61.vercel.app/api/webhook",
            "subtitle": "Shop smart. Earn onchain.",
            "description": "Verify your grocery receipts on Base. Earn XP for healthy shopping, build streaks, and compete on the leaderboard.",
            "screenshotUrls": [
                "https://replate61.vercel.app/replate-logo.png",
                "https://replate61.vercel.app/replate-logo.png",
                "https://replate61.vercel.app/replate-logo.png"
            ],
            "primaryCategory": "health-fitness",
            "tags": ["replate", "health", "food", "sustainability", "baseapp"],
            "heroImageUrl": "https://replate61.vercel.app/replate-logo.png",
            "tagline": "Shop smart. Earn onchain.",
            "ogTitle": "Replate — Healthy Shopping",
            "ogDescription": "Verify your grocery receipts on Base. Earn XP, build streaks, and win weekly rewards.",
            "ogImageUrl": "https://replate61.vercel.app/replate-logo.png",
            "noindex": true
        }
    }); // see the next step for the manifest_json_object
}