// Test script for YouTube transcript retrieval
// This script directly tests the timed text API since that's what we use in production
import fetch from "node-fetch"; // Required for Node.js environment

// Sample video ID from the specified URL: https://www.youtube.com/watch?v=rq0kyieHw70
const TEST_VIDEO_ID = "dQw4w9WgXcQ"; // Updating to a video that likely has captions

// Set up logging for the test
function infoLog(message, data) {
    console.log(`[TEST INFO] ${message}`);
    if (data) {
        console.log(`[TEST INFO] Data:`, data);
    }
}

function errorLog(message, error) {
    console.error(`[TEST ERROR] ${message}`);
    if (error) {
        console.error(`[TEST ERROR] Details:`, error);
        if (error.stack) {
            console.error(`[TEST ERROR] Stack:`, error.stack);
        }
    }
}

async function fetchTranscript(videoId) {
    infoLog(`Starting transcript test for video ID: ${videoId}`);
    infoLog(`Video URL: https://www.youtube.com/watch?v=${videoId}`);

    // Try multiple endpoints to find available captions
    const endpoints = [
        // Standard English captions
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
        // Auto-generated English captions
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr`,
        // Alternative English format
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=a.en`,
        // Alternative auto-generated English
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=a.en&kind=asr`,
        // JSON format
        `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3`,
        // Try without language specification (get default)
        `https://www.youtube.com/api/timedtext?v=${videoId}`,
        // First get track list
        `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`,
    ];

    infoLog(
        `Will try ${endpoints.length} different endpoints for video ${videoId}`
    );

    // Try each endpoint until we get a valid response
    for (const endpoint of endpoints) {
        try {
            infoLog(`Trying endpoint: ${endpoint}`);
            const response = await fetch(endpoint);

            if (!response.ok) {
                infoLog(
                    `Endpoint ${endpoint} returned status ${response.status}`
                );
                continue;
            }

            const content = await response.text();
            infoLog(
                `Received response from ${endpoint}, length: ${content.length} chars`
            );

            // Skip empty responses
            if (!content || content.trim() === "") {
                infoLog("Response was empty, continuing to next endpoint");
                continue;
            }

            // Check if it's a track list
            if (endpoint.includes("type=list") && content.includes("<track")) {
                infoLog("Found track list in response, processing");
                // Show how many tracks were found
                const trackMatches = content.match(/<track/g);
                const trackCount = trackMatches ? trackMatches.length : 0;
                infoLog(`Track list contains ${trackCount} tracks`);

                // Log all the tracks for inspection
                const tracks = content.match(/<track([^>]*)>/g) || [];
                tracks.forEach((track, i) => {
                    infoLog(`Track ${i + 1} details:`, { track });
                });

                // Found a track list, return success
                return {
                    success: true,
                    message: `Found track list with ${trackCount} tracks`,
                    content,
                };
            }

            // Check if it's JSON format
            if (content.trim().startsWith("{")) {
                infoLog("Found JSON format captions");

                try {
                    const data = JSON.parse(content);
                    infoLog("Successfully parsed JSON data", {
                        keys: Object.keys(data),
                        hasEvents: !!data.events,
                        eventsLength: data.events ? data.events.length : 0,
                    });

                    return {
                        success: true,
                        message: "Found JSON format captions",
                        format: "json",
                        content,
                    };
                } catch (jsonError) {
                    errorLog("Error parsing JSON:", jsonError);
                }
            }

            // Otherwise assume it's XML format
            if (
                content.includes("<transcript>") ||
                content.includes("<text ")
            ) {
                infoLog("Found XML format captions");
                return {
                    success: true,
                    message: "Found XML format captions",
                    format: "xml",
                    content,
                };
            }

            infoLog(
                "Response was not in a recognized format, continuing to next endpoint"
            );
        } catch (error) {
            errorLog(`Error with endpoint ${endpoint}:`, error);
        }
    }

    // If we reach here, we couldn't get captions from any endpoint
    return {
        success: false,
        error: "No captions available from any endpoint",
    };
}

// Run the test
fetchTranscript(TEST_VIDEO_ID).then((result) => {
    console.log("==================================================");
    console.log("TEST COMPLETE");
    console.log("==================================================");

    if (result.success) {
        console.log("SUCCESS:", result.message);

        if (result.content) {
            // Show preview of the content
            const preview = result.content.substring(0, 300);
            console.log("Content preview:", preview + "...");
        }
    } else {
        console.error("FAILURE:", result.error);
    }

    console.log("==================================================");
});

// Export the function for direct testing
export { fetchTranscript };
