export class YouTubeService {
    static extractVideoId(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === "youtu.be") {
                return urlObj.pathname.slice(1);
            }
            if (urlObj.hostname.includes("youtube.com")) {
                const searchParams = new URLSearchParams(urlObj.search);
                const videoId = searchParams.get("v");
                if (videoId)
                    return videoId;
                if (urlObj.pathname.startsWith("/v/")) {
                    return urlObj.pathname.slice(3);
                }
            }
            return null;
        }
        catch (error) {
            console.error("[YouTubeService] Error parsing URL:", error);
            return null;
        }
    }
    static isYouTubeVideo(url) {
        return !!YouTubeService.extractVideoId(url);
    }
    async getTranscript(videoId) {
        try {
            const captionsResponse = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`);
            if (!captionsResponse.ok) {
                throw new Error("Failed to fetch caption information");
            }
            const captionsText = await captionsResponse.text();
            if (!captionsText || captionsText.trim() === "") {
                throw new Error("No English captions available for this video");
            }
            const result = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (!result.length || !result[0].id) {
                throw new Error("No active tab found");
            }
            const tabId = result[0].id;
            const parseResult = await chrome.scripting.executeScript({
                target: { tabId },
                files: ["dist/xmlParser.js"],
            });
            const transcriptResult = await chrome.scripting.executeScript({
                target: { tabId },
                func: (xmlText) => {
                    const parser = window.parseXML;
                    const extractor = window.extractTextFromXML;
                    if (!parser || !extractor) {
                        throw new Error("XML parser functions not available");
                    }
                    const doc = parser(xmlText);
                    return extractor(doc);
                },
                args: [captionsText],
            });
            if (!transcriptResult ||
                !transcriptResult[0] ||
                !transcriptResult[0].result) {
                throw new Error("Failed to parse transcript");
            }
            return transcriptResult[0].result;
        }
        catch (error) {
            console.error("[YouTubeService] Error fetching transcript:", error);
            if (error instanceof Error) {
                throw new Error(`Failed to fetch transcript: ${error.message}`);
            }
            throw new Error("Failed to fetch transcript: Unknown error");
        }
    }
}
