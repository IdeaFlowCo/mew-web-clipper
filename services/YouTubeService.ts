/* YouTubeService.ts - Service for handling YouTube video transcripts */

/**
 * YouTube Service for extracting transcripts from YouTube videos.
 * Uses direct API calls to extract transcripts without relying on DOM scraping.
 */
export class YouTubeService {
    // Debug flag to enable verbose logging
    private static readonly DEBUG = true;

    /**
     * Logs debugging information when DEBUG is enabled
     */
    private static debugLog(message: string, data?: any): void {
        if (YouTubeService.DEBUG) {
            if (data) {
                console.log(`[YouTubeService DEBUG] ${message}`, data);
            } else {
                console.log(`[YouTubeService DEBUG] ${message}`);
            }
        }
    }

    /**
     * Logs error information
     */
    private static errorLog(message: string, error?: any): void {
        console.error(`[YouTubeService ERROR] ${message}`);
        if (error) {
            console.error(`[YouTubeService ERROR] Details:`, error);
            if (error.stack) {
                console.error(`[YouTubeService ERROR] Stack:`, error.stack);
            }
        }
    }

    /**
     * Logs general information
     */
    private static infoLog(message: string, data?: any): void {
        console.log(`[YouTubeService INFO] ${message}`);
        if (data) {
            console.log(`[YouTubeService INFO] Data:`, data);
        }
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
        try {
            const urlObj = new URL(url);

            // Handle youtu.be format
            if (urlObj.hostname === "youtu.be") {
                return urlObj.pathname.slice(1);
            }

            // Handle youtube.com formats
            if (
                urlObj.hostname.includes("youtube.com") ||
                urlObj.hostname.includes("youtube-nocookie.com")
            ) {
                // Handle watch?v= format
                const searchParams = new URLSearchParams(urlObj.search);
                const videoId = searchParams.get("v");
                if (videoId) return videoId;

                // Handle /v/ or /embed/ formats
                const pathMatch = urlObj.pathname.match(
                    /^\/(v|embed)\/([^\/\?]+)/
                );
                if (pathMatch) {
                    return pathMatch[2];
                }
            }

            return null;
        } catch (error) {
            console.error("[YouTubeService] Error parsing URL:", error);
            return null;
        }
    }

    /**
     * Checks if a given URL is a YouTube video
     */
    static isYouTubeVideo(url: string): boolean {
        return !!YouTubeService.extractVideoId(url);
    }

    /**
     * Main method to fetch transcript for a YouTube video.
     * Uses a direct API approach that's more reliable than DOM scraping.
     */
    async getTranscript(videoId: string): Promise<string> {
        YouTubeService.infoLog(
            `Starting transcript fetch for video ID: ${videoId}`
        );
        YouTubeService.infoLog(
            `Video URL: https://www.youtube.com/watch?v=${videoId}`
        );

        console.log("[TRANSCRIPT DEBUG] Starting transcript fetch process");

        try {
            // Try to get transcript via the timedtext API directly
            return await this.fetchDirectTranscript(videoId);
        } catch (error) {
            YouTubeService.errorLog(
                "Direct transcript API extraction failed",
                error
            );
            console.log(
                "[TRANSCRIPT DEBUG] Direct API approach failed, falling back to browser scraping"
            );

            // Fall back to browser scraping as a last resort
            return await this.fallbackToContentScript(videoId);
        }
    }

    /**
     * Fetches transcript by calling YouTube's timedtext API directly.
     * This method avoids DOM scraping completely for better reliability.
     */
    private async fetchDirectTranscript(videoId: string): Promise<string> {
        console.log("[TRANSCRIPT DEBUG] Starting direct API transcript fetch");

        // Try multiple endpoints to find available captions, in order of preference
        const endpoints = [
            // Get track list first to find available language options
            `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`,
            // Standard English captions
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
            // Auto-generated English captions
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr`,
            // Alternative English format
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=a.en`,
            // Alternative auto-generated English
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=a.en&kind=asr`,
            // JSON format (may contain more information)
            `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3`,
            // Try without language specification (get default)
            `https://www.youtube.com/api/timedtext?v=${videoId}`,
            // Additional endpoints that might work in some cases
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US`,
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-GB`,
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-CA`,
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-AU`,
        ];

        console.log(
            `[TRANSCRIPT DEBUG] Will try ${endpoints.length} different API endpoints`
        );

        // Track list response - needs special handling to extract available languages
        let trackListResponse: string | null = null;

        // First pass: try all endpoints and check for track list
        for (const endpoint of endpoints) {
            try {
                console.log(`[TRANSCRIPT DEBUG] Trying endpoint: ${endpoint}`);
                
                // Use a longer timeout for the fetch to ensure it has time to complete
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                const response = await fetch(endpoint, {
                    method: "GET",
                    credentials: "omit", // Don't send cookies
                    headers: {
                        Accept: "*/*",
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.log(
                        `[TRANSCRIPT DEBUG] Endpoint ${endpoint} returned status ${response.status}`
                    );
                    continue;
                }

                const content = await response.text();

                // Skip empty responses
                if (!content || content.trim() === "") {
                    console.log("[TRANSCRIPT DEBUG] Response was empty");
                    continue;
                }

                console.log(
                    `[TRANSCRIPT DEBUG] Received response from ${endpoint}, length: ${content.length} chars`
                );

                // If this is the track list, save it for later processing
                if (endpoint.includes("type=list")) {
                    if (content.includes("<track")) {
                        trackListResponse = content;
                        console.log(
                            "[TRANSCRIPT DEBUG] Found track list, will process later"
                        );
                        // continue to try other endpoints first before processing track list
                    }
                    continue;
                }

                // Process JSON format
                if (content.trim().startsWith("{")) {
                    console.log(
                        "[TRANSCRIPT DEBUG] Found JSON format captions"
                    );
                    try {
                        const transcript = this.parseJsonTranscript(content);
                        if (transcript) {
                            console.log(
                                "[TRANSCRIPT DEBUG] Successfully extracted transcript from JSON"
                            );
                            return transcript;
                        }
                    } catch (err) {
                        console.log(
                            "[TRANSCRIPT DEBUG] Failed to parse JSON transcript",
                            err
                        );
                    }
                }

                // Process XML format
                if (
                    content.includes("<transcript>") ||
                    content.includes("<text ")
                ) {
                    console.log("[TRANSCRIPT DEBUG] Found XML format captions");
                    try {
                        const transcript = this.parseXmlTranscript(content);
                        if (transcript) {
                            console.log(
                                "[TRANSCRIPT DEBUG] Successfully extracted transcript from XML"
                            );
                            return transcript;
                        }
                    } catch (err) {
                        console.log(
                            "[TRANSCRIPT DEBUG] Failed to parse XML transcript",
                            err
                        );
                    }
                }

                console.log(
                    "[TRANSCRIPT DEBUG] Response not in recognized format"
                );
            } catch (error) {
                console.error(
                    `[TRANSCRIPT DEBUG] Error with endpoint ${endpoint}:`,
                    error
                );
            }
        }

        // Second pass: If we have a track list but no transcript yet, try to find the languages and fetch them
        if (trackListResponse) {
            console.log(
                "[TRANSCRIPT DEBUG] Processing track list to find available languages"
            );
            try {
                const transcript = await this.processTrackList(
                    trackListResponse,
                    videoId
                );
                if (transcript) {
                    return transcript;
                }
            } catch (error) {
                console.error(
                    "[TRANSCRIPT DEBUG] Error processing track list:",
                    error
                );
            }
        }

        // Try to directly get the transcript from the YouTube internal data structure
        try {
            console.log("[TRANSCRIPT DEBUG] Attempting to extract from YouTube internal data");
            // This will be attempted in the browser scraping method
        } catch (error) {
            console.error("[TRANSCRIPT DEBUG] Error accessing internal data:", error);
        }

        throw new Error(
            "Could not find transcript through any direct API method"
        );
    }

    /**
     * Process the track list XML to find available languages and fetch the transcript
     */
    private async processTrackList(
        trackListXml: string,
        videoId: string
    ): Promise<string> {
        console.log("[TRANSCRIPT DEBUG] Parsing track list XML");

        // Extract tracks
        const tracks = trackListXml.match(/<track([^>]*)>/g) || [];
        console.log(`[TRANSCRIPT DEBUG] Found ${tracks.length} tracks`);

        if (tracks.length === 0) {
            throw new Error("No tracks found in track list");
        }

        // Look for English track first - expand the search to include more variants
        const englishTrack = tracks.find(
            (track) =>
                track.includes('lang_code="en"') ||
                track.includes('lang_code="a.en"') ||
                track.includes('lang_code="en-US"') ||
                track.includes('lang_code="en-GB"') ||
                track.includes('lang_code="en-CA"') ||
                track.includes('lang_code="en-AU"')
        );

        if (englishTrack) {
            const langMatch = englishTrack.match(/lang_code="([^"]+)"/);
            if (langMatch && langMatch[1]) {
                const langCode = langMatch[1];
                console.log(
                    `[TRANSCRIPT DEBUG] Found English track (${langCode}), fetching...`
                );
                return await this.fetchTrackByLanguage(videoId, langCode);
            }
        }

        // If no English track, try all available languages
        console.log(
            "[TRANSCRIPT DEBUG] No English track found, trying all available languages"
        );

        // Try each language track until one works
        for (const track of tracks) {
            const langMatch = track.match(/lang_code="([^"]+)"/);
            if (langMatch && langMatch[1]) {
                const langCode = langMatch[1];
                console.log(
                    `[TRANSCRIPT DEBUG] Trying track with language: ${langCode}`
                );
                try {
                    const transcript = await this.fetchTrackByLanguage(videoId, langCode);
                    if (transcript) {
                        return transcript;
                    }
                } catch (error) {
                    console.log(`[TRANSCRIPT DEBUG] Failed to fetch language ${langCode}:`, error);
                    // Continue to next language
                }
            }
        }

        throw new Error("Could not find any usable language tracks");
    }

    /**
     * Fetch a specific transcript track by language code
     */
    private async fetchTrackByLanguage(
        videoId: string,
        langCode: string
    ): Promise<string> {
        console.log(
            `[TRANSCRIPT DEBUG] Fetching specific language track: ${langCode}`
        );

        // Try both regular and auto-generated variants
        const endpoints = [
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}`,
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}&kind=asr`,
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}&fmt=json3`,
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(
                    `[TRANSCRIPT DEBUG] Trying language endpoint: ${endpoint}`
                );
                
                // Use a longer timeout for the fetch
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                const response = await fetch(endpoint, {
                    method: "GET",
                    credentials: "omit",
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.log(
                        `[TRANSCRIPT DEBUG] Endpoint returned status ${response.status}`
                    );
                    continue;
                }

                const content = await response.text();

                if (!content || content.trim() === "") {
                    console.log("[TRANSCRIPT DEBUG] Empty response");
                    continue;
                }

                // Process JSON format
                if (content.trim().startsWith("{")) {
                    try {
                        const transcript = this.parseJsonTranscript(content);
                        if (transcript) {
                            console.log("[TRANSCRIPT DEBUG] Successfully parsed JSON transcript");
                            return transcript;
                        }
                    } catch (err) {
                        console.log("[TRANSCRIPT DEBUG] Failed to parse JSON transcript", err);
                    }
                }

                // Process as XML
                if (
                    content.includes("<transcript>") ||
                    content.includes("<text ")
                ) {
                    const transcript = this.parseXmlTranscript(content);
                    if (transcript) {
                        console.log(
                            "[TRANSCRIPT DEBUG] Successfully parsed transcript XML"
                        );
                        return transcript;
                    }
                }

                console.log(
                    "[TRANSCRIPT DEBUG] Response not in expected format"
                );
            } catch (error) {
                console.error(
                    `[TRANSCRIPT DEBUG] Error fetching language track:`,
                    error
                );
            }
        }

        throw new Error(`Failed to fetch transcript for language: ${langCode}`);
    }

    /**
     * Parse transcript in XML format
     */
    private parseXmlTranscript(xmlContent: string): string {
        const textMatches = xmlContent.match(/<text[^>]*>([\s\S]*?)<\/text>/g);
        if (!textMatches || textMatches.length === 0) {
            return "";
        }

        let transcript = "";

        // Process each text element
        for (const textElement of textMatches) {
            // Extract start time
            const startMatch = textElement.match(/start="([^"]+)"/);
            const startTime = startMatch ? parseFloat(startMatch[1]) : 0;

            // Convert to MM:SS format
            const minutes = Math.floor(startTime / 60);
            const seconds = Math.floor(startTime % 60);
            const timestamp = `[${minutes.toString().padStart(2, "0")}:${seconds
                .toString()
                .padStart(2, "0")}]`;

            // Extract text content
            const textContent = textElement.replace(/<[^>]+>/g, "").trim();
            const decodedText = this.decodeHtmlEntities(textContent);

            if (decodedText) {
                transcript += `${timestamp} ${decodedText}\n`;
            }
        }

        return transcript.trim();
    }

    /**
     * Parse transcript in JSON format
     */
    private parseJsonTranscript(jsonContent: string): string {
        interface CaptionSegment {
            utf8?: string;
            [key: string]: any;
        }

        interface CaptionEvent {
            tStartMs?: number;
            segs?: CaptionSegment[];
            [key: string]: any;
        }

        try {
            const data = JSON.parse(jsonContent);

            if (
                !data.events ||
                !Array.isArray(data.events) ||
                data.events.length === 0
            ) {
                return "";
            }

            let transcript = "";

            data.events.forEach((event: CaptionEvent) => {
                if (event.segs && event.tStartMs !== undefined) {
                    // Convert timestamp to MM:SS format
                    const totalSeconds = Math.floor(event.tStartMs / 1000);
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
                    const timestamp = `[${minutes
                        .toString()
                        .padStart(2, "0")}:${seconds
                        .toString()
                        .padStart(2, "0")}]`;

                    // Concatenate all segments
                    const text = event.segs
                        .map((seg: CaptionSegment) => seg.utf8 || "")
                        .join("")
                        .trim();

                    if (text) {
                        transcript += `${timestamp} ${text}\n`;
                    }
                }
            });

            return transcript.trim();
        } catch (error) {
            console.error(
                "[TRANSCRIPT DEBUG] Error parsing JSON transcript:",
                error
            );
            return "";
        }
    }

    /**
     * Helper to decode HTML entities in transcript text
     */
    private decodeHtmlEntities(text: string): string {
        const entities: { [key: string]: string } = {
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": '"',
            "&#39;": "'",
            "&#x27;": "'",
            "&#x2F;": "/",
            "&#32;": " ",
            "&nbsp;": " ",
        };

        return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
    }

    /**
     * Fallback method that uses a content script to extract transcript
     * This is used only if all direct API methods fail
     */
    private async fallbackToContentScript(videoId: string): Promise<string> {
        console.log("[TRANSCRIPT DEBUG] Using fallback content script method");

        // Get the current active tab
        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        if (!tabs || tabs.length === 0) {
            throw new Error("No active tab found for fallback extraction");
        }

        const tab = tabs[0];

        // Navigate to the video page if needed
        let isOnCorrectPage = false;

        if (tab.url && YouTubeService.isYouTubeVideo(tab.url)) {
            const currentVideoId = YouTubeService.extractVideoId(tab.url);
            isOnCorrectPage = currentVideoId === videoId;
        }

        if (!isOnCorrectPage) {
            console.log("[TRANSCRIPT DEBUG] Navigating to YouTube video page");

            if (!tab.id) {
                throw new Error("Tab ID is undefined, cannot navigate");
            }

            await chrome.tabs.update(tab.id, {
                url: `https://www.youtube.com/watch?v=${videoId}`,
            });

            // Wait longer for the page to fully load - increased to 7 seconds
            await new Promise((resolve) => setTimeout(resolve, 7000));
            console.log(
                "[TRANSCRIPT DEBUG] Navigation complete, waited 7s for page to load"
            );
        } else {
            // Even if we're on the right page, wait a moment to ensure everything is loaded
            await new Promise((resolve) => setTimeout(resolve, 2000));
            console.log("[TRANSCRIPT DEBUG] Already on correct page, waited 2s for stability");
        }

        if (!tab.id) {
            throw new Error("Tab ID is undefined, cannot inject script");
        }

        // Create a promise wrapper around the script injection
        return new Promise<string>((resolve, reject) => {
            // Set a longer timeout to avoid hanging forever
            const timeoutId = setTimeout(() => {
                reject(
                    new Error(
                        "Transcript extraction timed out after 30 seconds"
                    )
                );
            }, 30000); // Increased from 20 to 30 seconds

            // Function to inject the core extraction script
            const injectExtractionScript = async () => {
                try {
                    console.log(
                        "[TRANSCRIPT DEBUG] Injecting extraction script"
                    );

                    // Define the return type for the extraction function
                    interface ExtractionResult {
                        success: boolean;
                        transcript?: string;
                        error?: string;
                    }

                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id! },
                        func: () => {
                            return new Promise<ExtractionResult>((resolve) => {
                                // Wait longer for the page to settle - increased to 5 seconds
                                setTimeout(async () => {
                                    try {
                                        console.log(
                                            "[FALLBACK] Starting transcript extraction"
                                        );

                                        // Try to extract from YouTube's internal data structure first
                                        try {
                                            // @ts-ignore - ytInitialData might exist in the page
                                            if (window.ytInitialData) {
                                                console.log("[FALLBACK] Found ytInitialData, attempting to extract transcript info");
                                                
                                                // @ts-ignore
                                                const ytData = window.ytInitialData;
                                                console.log("[FALLBACK] YouTube data structure size:", JSON.stringify(ytData).length);
                                                
                                                // Look for caption tracks in the data structure
                                                // This is an incomplete implementation as the structure is complex
                                                // and varies across YouTube versions
                                            }
                                        } catch (internalDataError) {
                                            console.log("[FALLBACK] Error accessing internal data:", internalDataError);
                                        }

                                        // First try to click the transcript button
                                        const clickTranscriptButton = () => {
                                            // More comprehensive button selection
                                            const allButtons = Array.from(
                                                document.querySelectorAll(
                                                    "button, [role='button'], .ytp-button, ytd-button-renderer, yt-button-renderer"
                                                )
                                            );
                                            
                                            console.log(`[FALLBACK] Found ${allButtons.length} possible buttons`);

                                            // Look for transcript button with expanded selectors
                                            const transcriptButton =
                                                allButtons.find(
                                                    (button) =>
                                                        button.textContent?.includes(
                                                            "Show transcript"
                                                        ) ||
                                                        button.textContent?.includes(
                                                            "Open transcript"
                                                        ) ||
                                                        button.getAttribute("aria-label")?.includes(
                                                            "transcript"
                                                        )
                                                );

                                            if (transcriptButton) {
                                                console.log(
                                                    "[FALLBACK] Found and clicking transcript button"
                                                );
                                                (transcriptButton as HTMLElement).click();
                                                return true;
                                            }

                                            // If not found, try to open the "More" menu first
                                            const moreButton = allButtons.find(
                                                (button) =>
                                                    button
                                                        .getAttribute(
                                                            "aria-label"
                                                        )
                                                        ?.includes(
                                                            "More actions"
                                                        ) ||
                                                    button.textContent?.includes(
                                                        "More"
                                                    ) ||
                                                    button.getAttribute("aria-label")?.includes(
                                                        "more"
                                                    ) ||
                                                    button.getAttribute("aria-label")?.includes(
                                                        "additional"
                                                    )
                                            );

                                            if (moreButton) {
                                                console.log(
                                                    "[FALLBACK] Clicking 'More' menu button"
                                                );
                                                (moreButton as HTMLElement).click();

                                                // Wait for menu to appear then look for transcript option
                                                setTimeout(() => {
                                                    // More comprehensive menu item selection
                                                    const menuItems =
                                                        document.querySelectorAll(
                                                            "button, ytd-menu-service-item-renderer, tp-yt-paper-item, .ytp-menuitem, [role='menuitem']"
                                                        );
                                                    
                                                    console.log(`[FALLBACK] Found ${menuItems.length} menu items`);
                                                    
                                                    const transcriptItem =
                                                        Array.from(
                                                            menuItems
                                                        ).find(
                                                            (item) =>
                                                                item.textContent?.includes(
                                                                    "Show transcript"
                                                                ) ||
                                                                item.textContent?.includes(
                                                                    "Open transcript"
                                                                ) ||
                                                                item.getAttribute("aria-label")?.includes(
                                                                    "transcript"
                                                                )
                                                        );

                                                    if (transcriptItem) {
                                                        console.log(
                                                            "[FALLBACK] Clicking transcript menu item"
                                                        );
                                                        (
                                                            transcriptItem as HTMLElement
                                                        ).click();
                                                    } else {
                                                        console.log("[FALLBACK] No transcript menu item found");
                                                    }
                                                }, 1500); // Increased from 1000 to 1500ms

                                                return true;
                                            }

                                            // Last resort: try looking for a transcript button by its position
                                            console.log("[FALLBACK] Trying to find transcript button by position");
                                            
                                            // This is a fallback approach that might be helpful in some cases
                                            // but could be unreliable if YouTube changes its UI
                                            
                                            return false;
                                        };

                                        // Try to click the button and wait for transcript to load
                                        const buttonClicked =
                                            clickTranscriptButton();
                                        if (buttonClicked) {
                                            // Wait longer for transcript panel to appear - increased to 4 seconds
                                            await new Promise((resolve) =>
                                                setTimeout(resolve, 4000)
                                            );
                                            console.log("[FALLBACK] Waited 4s after clicking button");
                                        } else {
                                            console.log("[FALLBACK] Could not find any transcript button");
                                        }

                                        // Now look for transcript content with enhanced selectors
                                        const extractTranscript = () => {
                                            // More comprehensive transcript panel selection
                                            const transcriptPanel =
                                                document.querySelector(
                                                    "ytd-transcript-renderer"
                                                ) ||
                                                document.querySelector(
                                                    '[id="transcript-panel"]'
                                                ) ||
                                                document.querySelector(
                                                    '[id="transcript"]'
                                                ) ||
                                                document.querySelector(
                                                    '[class*="transcript"]'
                                                ) ||
                                                document.querySelector(
                                                    '.ytd-transcript-search-panel-renderer'
                                                );

                                            if (!transcriptPanel) {
                                                console.log(
                                                    "[FALLBACK] No transcript panel found"
                                                );
                                                return null;
                                            }

                                            console.log("[FALLBACK] Found transcript panel:", transcriptPanel.tagName, 
                                                        transcriptPanel.className || "no-class");

                                            // More comprehensive segment selection
                                            const segments =
                                                transcriptPanel.querySelectorAll(
                                                    "ytd-transcript-segment-renderer, .segment, [class*='segment'], [class*='transcript-segment']"
                                                );

                                            if (
                                                !segments ||
                                                segments.length === 0
                                            ) {
                                                console.log(
                                                    "[FALLBACK] No transcript segments found in panel"
                                                );
                                                return null;
                                            }

                                            console.log(
                                                `[FALLBACK] Found ${segments.length} transcript segments`
                                            );

                                            // Extract text
                                            let transcript = "";
                                            let segmentsProcessed = 0;

                                            Array.from(segments).forEach(
                                                (segment) => {
                                                    // More comprehensive timestamp element selection
                                                    const timestampElem =
                                                        segment.querySelector(
                                                            ".segment-timestamp"
                                                        ) ||
                                                        segment.querySelector(
                                                            '[class*="timestamp"]'
                                                        ) ||
                                                        segment.querySelector(
                                                            '[class*="time"]'
                                                        );

                                                    // More comprehensive text element selection
                                                    const textElem =
                                                        segment.querySelector(
                                                            ".segment-text"
                                                        ) ||
                                                        segment.querySelector(
                                                            '[class*="text"]'
                                                        ) ||
                                                        segment.querySelector(
                                                            "span:not([class*='timestamp'])"
                                                        );

                                                    if (
                                                        timestampElem &&
                                                        textElem
                                                    ) {
                                                        const timestamp =
                                                            timestampElem.textContent?.trim() ||
                                                            "";
                                                        const text =
                                                            textElem.textContent?.trim() ||
                                                            "";

                                                        if (timestamp && text) {
                                                            const formattedTimestamp = `[${timestamp}]`;
                                                            transcript += `${formattedTimestamp} ${text}\n`;
                                                            segmentsProcessed++;
                                                        }
                                                    }
                                                }
                                            );

                                            console.log(`[FALLBACK] Processed ${segmentsProcessed} out of ${segments.length} segments`);

                                            return transcript.trim();
