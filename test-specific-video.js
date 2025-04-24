// Test script for the specific YouTube video with transcript extraction issues
import puppeteer from "puppeteer";

const TEST_VIDEO_ID = "Rz-4ulRKnz4"; // The video ID from the example URL

async function testSpecificVideo() {
    console.log(`Testing transcript extraction for video ID: ${TEST_VIDEO_ID}`);
    console.log(`Video URL: https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`);

    // Launch a new browser
    const browser = await puppeteer.launch({
        headless: false, // Use visible browser for debugging
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    try {
        // Enable verbose console logging from the page
        page.on("console", (msg) => {
            const text = msg.text();
            if (
                text.includes("[TRANSCRIPT DEBUG]") ||
                text.includes("[YouTubeService]")
            ) {
                console.log(`PAGE LOG: ${text}`);
            }
        });

        // Navigate to the YouTube video
        await page.goto(`https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`, {
            waitUntil: "domcontentloaded",
        });
        console.log("Page loaded, waiting for content to stabilize...");
        // Replace waitForTimeout with a delay using setTimeout
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Search for and click the transcript button
        const findAndClickTranscriptButton = async () => {
            // First try to find the standalone transcript button
            const foundDirectButton = await page.evaluate(() => {
                const menuButtons = Array.from(
                    document.querySelectorAll("button")
                );
                const transcriptButton = menuButtons.find(
                    (button) =>
                        button.textContent?.includes("Show transcript") ||
                        button.textContent?.includes("Open transcript")
                );

                if (transcriptButton) {
                    console.log(
                        "Found direct transcript button, clicking it..."
                    );
                    transcriptButton.click();
                    return true;
                }
                return false;
            });

            if (foundDirectButton) {
                console.log("Clicked direct transcript button");
                return true;
            }

            // If direct button not found, try opening the "..." menu first
            console.log("Direct button not found, trying menu...");
            const menuOpened = await page.evaluate(() => {
                const menuButtons = Array.from(
                    document.querySelectorAll("button")
                );
                const moreButton = menuButtons.find(
                    (button) =>
                        button
                            .getAttribute("aria-label")
                            ?.includes("More actions") ||
                        button.textContent?.includes("More") ||
                        button.innerHTML?.includes("More")
                );

                if (moreButton) {
                    console.log("Found 'More' menu button, clicking it...");
                    moreButton.click();
                    return true;
                }
                return false;
            });

            if (menuOpened) {
                console.log(
                    "Clicked 'More' menu button, waiting for menu to appear..."
                );
                // Replace waitForTimeout with a delay using setTimeout
                await new Promise((resolve) => setTimeout(resolve, 1000));

                // Now try to find and click the transcript option in the menu
                const foundInMenu = await page.evaluate(() => {
                    const menuItems = Array.from(
                        document.querySelectorAll("button, yt-formatted-string")
                    );
                    const transcriptMenuItem = menuItems.find(
                        (item) =>
                            item.textContent?.includes("Show transcript") ||
                            item.textContent?.includes("Open transcript")
                    );

                    if (transcriptMenuItem) {
                        console.log(
                            "Found transcript option in menu, clicking it..."
                        );
                        transcriptMenuItem.click();
                        return true;
                    }
                    return false;
                });

                if (foundInMenu) {
                    console.log("Clicked transcript option from menu");
                    return true;
                }
            }

            console.log("Could not find transcript button anywhere");
            return false;
        };

        console.log("Looking for transcript button...");
        const foundTranscriptButton = await findAndClickTranscriptButton();

        if (foundTranscriptButton) {
            console.log(
                "Found and clicked transcript button, waiting for panel to appear..."
            );
            // Replace waitForTimeout with a delay using setTimeout
            await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
            console.log(
                "Could not find transcript button, but will try extraction anyway..."
            );
        }

        // Try our improved transcript extraction method
        const extractionResult = await page.evaluate(() => {
            console.log(
                "Starting transcript extraction with improved methods..."
            );

            // First try: Standard extraction from transcript panel
            const tryStandardExtraction = () => {
                // Find the transcript panel
                const transcriptPanel =
                    document.querySelector("ytd-transcript-renderer") ||
                    document.querySelector('[id="transcript-panel"]') ||
                    document.querySelector('[id="transcript"]');

                if (!transcriptPanel) {
                    console.log(
                        "No transcript panel found through standard selectors"
                    );
                    return null;
                }

                console.log("Found transcript panel, looking for segments...");

                // Find all transcript segments
                const segments =
                    transcriptPanel.querySelectorAll(
                        "ytd-transcript-segment-renderer"
                    ) || transcriptPanel.querySelectorAll(".segment");

                if (!segments || segments.length === 0) {
                    console.log("No transcript segments found in panel");
                    return null;
                }

                console.log(`Found ${segments.length} transcript segments`);

                let transcript = "";
                let segmentsProcessed = 0;

                Array.from(segments).forEach((segment) => {
                    // Get timestamp
                    const timestampElem =
                        segment.querySelector(".segment-timestamp") ||
                        segment.querySelector('[class*="timestamp"]');

                    // Get text
                    const textElem =
                        segment.querySelector(".segment-text") ||
                        segment.querySelector('[class*="text"]');

                    if (timestampElem && textElem) {
                        const timestamp =
                            timestampElem.textContent?.trim() || "";
                        const text = textElem.textContent?.trim() || "";

                        if (timestamp && text) {
                            // Format as [MM:SS]
                            const formattedTimestamp = `[${timestamp}]`;
                            transcript += `${formattedTimestamp} ${text}\n`;
                            segmentsProcessed++;
                        }
                    }
                });

                console.log(
                    `Processed ${segmentsProcessed} out of ${segments.length} segments`
                );

                if (transcript.trim()) {
                    return {
                        transcript: transcript.trim(),
                        method: "standard",
                    };
                }

                return null;
            };

            // Second try: Raw extraction from any transcript-related elements
            const tryRawExtraction = () => {
                console.log("Attempting raw transcript extraction...");

                // Get all text content from any element that might contain transcript data
                const allPossibleTranscriptElements = document.querySelectorAll(
                    '[class*="transcript"] yt-formatted-string, ' +
                        '[id*="transcript"] yt-formatted-string, ' +
                        "ytd-transcript-segment-renderer, " +
                        ".ytd-transcript-renderer yt-formatted-string, " +
                        ".segment-text, " +
                        '[class*="segment-text"]'
                );

                if (
                    !allPossibleTranscriptElements ||
                    allPossibleTranscriptElements.length === 0
                ) {
                    console.log("No possible transcript elements found");
                    return null;
                }

                console.log(
                    `Found ${allPossibleTranscriptElements.length} possible transcript elements`
                );

                // Extract text content from all elements
                let rawTranscript = []; // Array of strings to store transcript text
                allPossibleTranscriptElements.forEach((el) => {
                    const text = el.textContent?.trim();
                    if (text && text.length > 0) {
                        rawTranscript.push(text);
                    }
                });

                if (rawTranscript.length === 0) {
                    console.log("No text content found in transcript elements");
                    return null;
                }

                console.log(`Extracted ${rawTranscript.length} raw text items`);

                // Simple deduplication
                const uniqueLines = [...new Set(rawTranscript)];
                console.log(
                    `After deduplication: ${uniqueLines.length} unique lines`
                );

                // Format the transcript
                const formattedTranscript = uniqueLines.join("\n");

                return {
                    transcript: formattedTranscript,
                    method: "raw",
                    lineCount: uniqueLines.length,
                };
            };

            // Try each extraction method in order
            const standardResult = tryStandardExtraction();
            if (standardResult) {
                console.log(
                    "Successfully extracted transcript with standard method"
                );
                return standardResult;
            }

            const rawResult = tryRawExtraction();
            if (rawResult) {
                console.log(
                    "Successfully extracted transcript with raw method"
                );
                return rawResult;
            }

            return { error: "All extraction methods failed" };
        });

        console.log("\n=== TRANSCRIPT EXTRACTION RESULT ===\n");

        if (extractionResult.error) {
            console.error(`EXTRACTION ERROR: ${extractionResult.error}`);
        } else if (extractionResult.transcript) {
            console.log(
                `EXTRACTION SUCCESS! Method: ${extractionResult.method}`
            );
            const lineCount = extractionResult.transcript.split("\n").length;
            console.log(`Found transcript with ${lineCount} lines`);

            console.log("\nPREVIEW (first 10 lines):");
            console.log(
                extractionResult.transcript.split("\n").slice(0, 10).join("\n")
            );
        } else {
            console.error("EXTRACTION FAILED: Unknown reason");
        }
    } catch (error) {
        console.error("TEST ERROR:", error);
    } finally {
        console.log("\nClosing browser in 5 seconds...");
        // Keep browser open for a while so you can see the result
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await browser.close();
    }
}

// Run the test
testSpecificVideo().catch(console.error);
