// Test script for browser-based YouTube transcript extraction
import puppeteer from "puppeteer";

const TEST_VIDEO_ID = "dQw4w9WgXcQ"; // Rick Astley - Never Gonna Give You Up

async function testBrowserTranscriptExtraction() {
    console.log(
        `Starting browser transcript extraction test for video: ${TEST_VIDEO_ID}`
    );
    console.log(`Video URL: https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`);

    // Launch a new browser
    const browser = await puppeteer.launch({
        headless: false, // Use visible browser for debugging
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    try {
        // Navigate to the YouTube video
        await page.goto(`https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`, {
            waitUntil: "domcontentloaded",
        });
        console.log("Page loaded, waiting for content to stabilize...");
        await page.waitForTimeout(3000);

        // Search for and click the transcript button
        const findTranscriptButton = async () => {
            return await page.evaluate(() => {
                const menuButtons = Array.from(
                    document.querySelectorAll("button")
                );
                const transcriptButton = menuButtons.find(
                    (button) =>
                        button.textContent?.includes("Show transcript") ||
                        button.textContent?.includes("Open transcript")
                );

                if (transcriptButton) {
                    transcriptButton.click();
                    return true;
                }
                return false;
            });
        };

        console.log("Looking for transcript button...");
        const foundTranscriptButton = await findTranscriptButton();
        if (foundTranscriptButton) {
            console.log(
                "Found and clicked transcript button, waiting for transcript panel to appear..."
            );
        } else {
            console.log(
                "Transcript button not found, looking for menu options..."
            );

            // Try clicking the "..." menu first if transcript button wasn't directly found
            await page.evaluate(() => {
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
                if (moreButton) moreButton.click();
            });

            await page.waitForTimeout(1000);
            const foundInMenu = await findTranscriptButton();
            if (foundInMenu) {
                console.log(
                    "Found transcript option in menu, waiting for transcript panel..."
                );
            } else {
                console.log("Could not find transcript button in menu either");
            }
        }

        // Wait for transcript panel to appear and stabilize
        await page.waitForTimeout(2000);

        // Extract the transcript
        const extractionResult = await page.evaluate(() => {
            // Find the transcript panel
            const transcriptPanel =
                document.querySelector("ytd-transcript-renderer") ||
                document.querySelector('[id="transcript-panel"]') ||
                document.querySelector('[id="transcript"]');

            if (!transcriptPanel) {
                return { error: "Transcript panel not found" };
            }

            // Find all transcript segments
            const segments =
                transcriptPanel.querySelectorAll(
                    "ytd-transcript-segment-renderer"
                ) || transcriptPanel.querySelectorAll(".segment");

            if (!segments || segments.length === 0) {
                return { error: "No transcript segments found" };
            }

            console.log(`Found ${segments.length} transcript segments`);

            let transcript = "";

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
                    const timestamp = timestampElem.textContent?.trim() || "";
                    const text = textElem.textContent?.trim() || "";

                    if (timestamp && text) {
                        // Format as [MM:SS]
                        const formattedTimestamp = `[${timestamp}]`;
                        transcript += `${formattedTimestamp} ${text}\n`;
                    }
                }
            });

            if (transcript.trim()) {
                return { transcript: transcript.trim() };
            } else {
                return { error: "Empty transcript" };
            }
        });

        console.log("\n=== TRANSCRIPT EXTRACTION RESULT ===\n");

        if (extractionResult.error) {
            console.error(`EXTRACTION ERROR: ${extractionResult.error}`);
        } else if (extractionResult.transcript) {
            console.log("EXTRACTION SUCCESS!");
            console.log(
                `Found transcript with ${
                    extractionResult.transcript.split("\n").length
                } lines`
            );
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
        console.log("\nClosing browser...");
        await browser.close();
    }
}

// Run the test
testBrowserTranscriptExtraction().catch(console.error);
