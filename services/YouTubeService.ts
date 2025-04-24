/* YouTubeService.ts - Service for handling YouTube video transcripts */

/**
 * YouTube Service for extracting transcripts from YouTube videos.
 * Uses direct API calls to extract transcripts without relying on DOM scraping.
 */
export class YouTubeService {
    // Debug flag to enable verbose logging
    private static readonly DEBUG = true;
    private apiKey = "";

    /**
     * Logs debugging information when DEBUG is enabled
     */
    private static debugLog(message: string, data?: any): void {
        if (YouTubeService.DEBUG) {
            console.log(`[YouTubeService Debug] ${message}`, data || "");
        }
    }

    /**
     * Logs error information
     */
    private static errorLog(message: string, error?: any): void {
        console.error(`[YouTubeService Error] ${message}`, error || "");
    }

    /**
     * Logs general information
     */
    private static infoLog(message: string, data?: any): void {
        console.info(`[YouTubeService Info] ${message}`, data || "");
    }

    async setApiKey(key: string): Promise<void> {
        this.apiKey = key;
        await chrome.storage.local.set({ youtubeApiKey: key });
        YouTubeService.infoLog("YouTube API key saved");
    }

    async getApiKey(): Promise<string> {
        if (this.apiKey) {
            return this.apiKey;
        }

        const result = await chrome.storage.local.get("youtubeApiKey");
        this.apiKey = result.youtubeApiKey || "";
        return this.apiKey;
    }

    /**
     * Extracts video ID from a YouTube URL
     * Supports formats:
     * - youtube.com/watch?v=VIDEO_ID
     * - youtu.be/VIDEO_ID
     * - youtube.com/v/VIDEO_ID
     * - youtube.com/embed/VIDEO_ID
     */
    static extractVideoId(url: string): string | null {
        if (!url) return null;

        // Handle youtu.be short links
        const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (shortMatch) return shortMatch[1];

        // Handle standard youtube.com links
        let videoIdMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch) return videoIdMatch[1];

        // Handle /embed/ format
        videoIdMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch) return videoIdMatch[1];

        // Handle /v/ format
        videoIdMatch = url.match(/\/v\/([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch) return videoIdMatch[1];

        return null;
    }

    /**
     * Checks if a given URL is a YouTube video
     */
    static isYouTubeVideo(url: string): boolean {
        return (
            !!url &&
            (url.includes("youtube.com/watch") ||
                url.includes("youtu.be/") ||
                url.includes("youtube.com/embed") ||
                url.includes("youtube.com/v/"))
        );
    }

    /**
     * Main method to fetch transcript for a YouTube video.
     * Uses a direct API approach that's more reliable than DOM scraping.
     */
    async getTranscript(videoId: string): Promise<string> {
        try {
            YouTubeService.infoLog(`Getting transcript for video ${videoId}`);

            // Try direct fetch methods first
            try {
                const transcript = await this.fetchDirectTranscript(videoId);
                if (transcript) {
                    return transcript;
                }
            } catch (error) {
                YouTubeService.errorLog(
                    "Direct transcript fetch failed",
                    error
                );
            }

            // If direct methods fail, return empty string
            return "";
        } catch (error) {
            YouTubeService.errorLog("Error getting transcript", error);
            return "";
        }
    }

    /**
     * Fetches transcript by calling YouTube's timedtext API directly.
     * This method avoids DOM scraping completely for better reliability.
     */
    private async fetchDirectTranscript(videoId: string): Promise<string> {
        console.log("[TRANSCRIPT DEBUG] Starting direct API transcript fetch");

        // Try YouTube API captions endpoint
        const captionUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`;

        try {
            const response = await fetch(captionUrl);
            if (response.ok) {
                const text = await response.text();
                if (text && text.includes("<text")) {
                    return this.parseXmlTranscript(text);
                }
            }
        } catch (error) {
            console.error("Error fetching transcript:", error);
        }

        // If we can't get the transcript, throw an error
        throw new Error("Could not fetch transcript");
    }

    /**
     * Parse transcript in XML format
     */
    private parseXmlTranscript(xmlContent: string): string {
        let transcript = "";

        // Very basic XML parsing - would be better with a proper XML parser
        const textTags = xmlContent.match(/<text[^>]*>(.*?)<\/text>/g) || [];

        for (const tag of textTags) {
            // Extract content and timing
            const contentMatch = tag.match(/<text[^>]*>(.*?)<\/text>/);
            const startMatch = tag.match(/start="([^"]*)"/);

            if (contentMatch && startMatch) {
                const content = this.decodeHtmlEntities(contentMatch[1]);
                const startTime = parseFloat(startMatch[1]);

                // Format timestamp
                const minutes = Math.floor(startTime / 60);
                const seconds = Math.floor(startTime % 60);
                const timestamp = `[${minutes}:${seconds
                    .toString()
                    .padStart(2, "0")}]`;

                transcript += `${timestamp} ${content}\n`;
            }
        }

        return transcript;
    }

    /**
     * Helper to decode HTML entities in transcript text
     */
    private decodeHtmlEntities(text: string): string {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = text;
        return textarea.value;
    }
}
