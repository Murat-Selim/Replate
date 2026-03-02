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
            "homeUrl": "https://replate.vercel.app",
            "iconUrl": "https://replate.vercel.app/i.png",
            "splashImageUrl": "https://replate.vercel.app/l.png",
            "splashBackgroundColor": "#000000",
            "webhookUrl": "https://replate.vercel.app/api/webhook",
            "subtitle": "Fast, fun, social",
            "description": "A fast, fun way to challenge friends in real time.",
            "screenshotUrls": [
                "https://replate.vercel.app/s1.png",
                "https://replate.vercel.app/s2.png",
                "https://replate.vercel.app/s3.png"
            ],
            "primaryCategory": "social",
            "tags": ["replate", "miniapp", "baseapp"],
            "heroImageUrl": "https://replate.vercel.app/og.png",
            "tagline": "Play instantly",
            "ogTitle": "Replate",
            "ogDescription": "Challenge friends in real time.",
            "ogImageUrl": "https://replate.vercel.app/og.png",
            "noindex": true
        }
    }); // see the next step for the manifest_json_object
}