export async function getTranscript(videoUrl) {
    try {
        const url = new URL(videoUrl);
        const videoId = url.searchParams.get("v");
        if (!videoId) {
            throw new Error("Invalid YouTube URL: video id not found");
        }
        console.log("[youtubeService] Fetching transcript for video:", videoId);
        const transcriptEndpoint = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`;
        console.log("[youtubeService] Making request to:", transcriptEndpoint);
        const response = await fetch(transcriptEndpoint);
        console.log("[youtubeService] Response status:", response.status);
        if (!response.ok) {
            const errorText = await response
                .text()
                .catch(() => "Could not read error response");
            console.error("[youtubeService] Error response body:", errorText);
            throw new Error(`Failed to fetch transcript: ${response.status} - ${response.statusText}`);
        }
        const xmlText = await response.text();
        console.log("[youtubeService] Received XML response length:", xmlText.length);
        if (xmlText.length === 0) {
            throw new Error("Empty response received from YouTube API");
        }
        const textMatches = xmlText.match(/<text[^>]*>([^<]*)<\/text>|<text[^>]*\/>/g) || [];
        console.log("[youtubeService] Found text matches:", textMatches.length);
        const transcript = textMatches
            .map((match) => {
            const textContent = match.match(/>([^<]*)</)?.[1] || "";
            return textContent
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
        })
            .filter((text) => text.trim().length > 0)
            .join(" ");
        if (!transcript) {
            throw new Error("No transcript text found in the response");
        }
        console.log("[youtubeService] Successfully extracted transcript of length:", transcript.length);
        return transcript;
    }
    catch (error) {
        console.error("[youtubeService] Error in getTranscript:", error);
        const errorDetails = {};
        if (error instanceof Error) {
            errorDetails.name = error.name;
            errorDetails.message = error.message;
            errorDetails.stack = error.stack || "";
        }
        else {
            errorDetails.message = String(error);
        }
        console.error("[youtubeService] Error details:", errorDetails);
        throw error;
    }
}
