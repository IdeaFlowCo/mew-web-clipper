/* background.ts - Background script for Mew Web Clipper extension */

import { ensureMyClips, getArticleNode, addClip } from "./mewClipper";
import { mewApi } from "./mewClipper";
import { YouTubeService } from "./services/YouTubeService";

// Global error handler for the service worker
self.addEventListener("error", (event) => {
    console.error("[ServiceWorker] Uncaught error:", event.error);
});

// Global unhandled promise rejection handler
self.addEventListener("unhandledrejection", (event) => {
    console.error("[ServiceWorker] Unhandled promise rejection:", event.reason);
});

const youtubeService = new YouTubeService();

// Function to inject notification system into a tab
async function injectNotificationSystem(tabId: number) {
    // Inject CSS
    await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["notification.css"],
    });

    // Inject notification script
    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["notification.js"],
    });
}

// Function to show notification in a tab
async function showNotification(tabId: number, message: string) {
    await chrome.scripting.executeScript({
        target: { tabId },
        func: (msg) => {
            // Get the showNotification function from the injected script
            const showNotification = (window as any).showNotification;
            if (showNotification) {
                showNotification(msg);
            }
        },
        args: [message],
    });
}

console.log("[Background] Mew Web Clipper extension background initialized.");

// Clear storage command for development/testing
chrome.runtime.onInstalled.addListener(async () => {
    console.log(
        "[Background] onInstalled event fired. Creating context menu items."
    );
    chrome.contextMenus.create({
        id: "clearStorage",
        title: "Clear Mew Storage (Debug)",
        contexts: ["page"],
    });
    chrome.contextMenus.create({
        id: "saveSelection",
        title: "Save Selection to Mew",
        contexts: ["selection"],
    });
    chrome.contextMenus.create({
        id: "savePage",
        title: "Save Page to Mew",
        contexts: ["page"],
    });

    // Add YouTube API key configuration menu item
    chrome.contextMenus.create({
        id: "setYouTubeApiKey",
        title: "Set YouTube API Key",
        contexts: ["page"],
    });

    // Check if both user node id and root url have been properly set
    const { userNodeId, userRootUrl } = await chrome.storage.local.get([
        "userNodeId",
        "userRootUrl",
    ]);
    if (
        !userNodeId ||
        !userRootUrl ||
        !userRootUrl.includes("mew-edge.ideaflow.app")
    ) {
        console.log(
            "[Background] Missing or invalid user configuration. Opening setup window."
        );
        // Clear any potentially invalid stored values
        await chrome.storage.local.remove(["userNodeId", "userRootUrl"]);
        chrome.windows.create({
            url: "setup.html",
            type: "normal",
            width: 600,
            height: 400,
        });
    } else {
        console.log("[Background] User configuration verified:", {
            userNodeId,
            userRootUrl,
        });
    }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("[Background] Context menu clicked. Info:", info);
    if (!tab || !tab.id) {
        console.error("[Background] No tab information available.");
        return;
    }

    try {
        // Check if we have valid configuration before proceeding
        const { userNodeId, userRootUrl } = await chrome.storage.local.get([
            "userNodeId",
            "userRootUrl",
        ]);
        if (
            !userNodeId ||
            !userRootUrl ||
            !userRootUrl.includes("mew-edge.ideaflow.app")
        ) {
            throw new Error("Please complete the Mew Web Clipper setup first");
        }

        if (info.menuItemId === "clearStorage") {
            await chrome.storage.local.clear();
            console.log("[Background] Cleared local storage");
            return;
        }

        if (info.menuItemId === "setYouTubeApiKey") {
            // Prompt user for YouTube API key
            if (tab.id) {
                await injectNotificationSystem(tab.id);
                const result = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        return prompt("Enter your YouTube Data API key:");
                    },
                });

                if (result && result[0] && result[0].result) {
                    const apiKey = result[0].result;
                    try {
                        await youtubeService.setApiKey(apiKey);
                        await showNotification(
                            tab.id,
                            "YouTube API key saved successfully"
                        );
                        console.log("[Background] YouTube API key saved");
                    } catch (error) {
                        console.error(
                            "[Background] Error saving YouTube API key:",
                            error
                        );
                        await showNotification(
                            tab.id,
                            "Error saving YouTube API key"
                        );
                    }
                } else {
                    console.log(
                        "[Background] API key setting cancelled by user"
                    );
                    await showNotification(tab.id, "API key setting cancelled");
                }
            }
            return;
        }

        // Optimistic UI: Show notification immediately
        if (tab.id) {
            await injectNotificationSystem(tab.id);
            await showNotification(tab.id, "Saving to My Highlights...");
        }

        const myClipsFolderId = await ensureMyClips();
        console.log("[Mew API] ensureMyClips response:", myClipsFolderId);

        if (!tab.title || !tab.url) {
            console.error("[Background] Tab missing title or url.");
            return;
        }

        const articleNodeId = await getArticleNode(
            tab.title,
            tab.url,
            myClipsFolderId
        );
        console.log("[Mew API] getArticleNode response:", articleNodeId);

        // Handle YouTube video transcript
        if (YouTubeService.isYouTubeVideo(tab.url)) {
            try {
                const videoId = YouTubeService.extractVideoId(tab.url);
                if (!videoId) {
                    throw new Error("Failed to extract video ID");
                }

                // Check if Transcript node already exists
                const existingTranscript = await mewApi.findNodeByText({
                    parentNodeId: articleNodeId,
                    nodeText: "Transcript",
                });

                // Only create a Transcript node if we can successfully fetch a transcript
                if (!existingTranscript) {
                    console.log("[Background] Fetching YouTube transcript");

                    try {
                        // First try to get transcript with our multi-approach service
                        let transcript = await youtubeService.getTranscript(
                            videoId
                        );

                        // Check if the result is a caption URL that needs to be fetched
                        if (transcript.startsWith("CAPTION_URL:")) {
                            console.log(
                                "[Background] Received caption URL from page scraping"
                            );
                            const captionUrl = transcript.substring(
                                "CAPTION_URL:".length
                            );

                            try {
                                // Fetch the caption URL
                                const response = await fetch(captionUrl);
                                if (response.ok) {
                                    const captionText = await response.text();

                                    // Parse the XML caption data
                                    if (captionText.includes("<text ")) {
                                        // Simple XML parsing to extract captions
                                        const parser = new DOMParser();
                                        const xmlDoc = parser.parseFromString(
                                            captionText,
                                            "text/xml"
                                        );
                                        const textElements =
                                            xmlDoc.getElementsByTagName("text");

                                        let parsedTranscript = "";
                                        for (
                                            let i = 0;
                                            i < textElements.length;
                                            i++
                                        ) {
                                            const element = textElements[i];
                                            const text =
                                                element.textContent || "";
                                            const start =
                                                element.getAttribute("start");

                                            if (text.trim() && start) {
                                                const seconds =
                                                    parseFloat(start);
                                                const minutes = Math.floor(
                                                    seconds / 60
                                                );
                                                const remainingSeconds =
                                                    Math.floor(seconds % 60);
                                                const timestamp = `[${minutes
                                                    .toString()
                                                    .padStart(
                                                        2,
                                                        "0"
                                                    )}:${remainingSeconds
                                                    .toString()
                                                    .padStart(2, "0")}]`;

                                                parsedTranscript += `${timestamp} ${text.trim()}\n`;
                                            }
                                        }

                                        if (parsedTranscript.trim()) {
                                            transcript =
                                                parsedTranscript.trim();
                                            console.log(
                                                "[Background] Successfully parsed caption URL data"
                                            );
                                        }
                                    }
                                }
                            } catch (captionError) {
                                console.error(
                                    "[Background] Error fetching caption URL:",
                                    captionError
                                );
                            }
                        }

                        // Only create the Transcript node if we have a valid transcript
                        if (transcript && transcript.trim()) {
                            // Create Transcript node
                            const transcriptNodeId = await addClip(
                                articleNodeId,
                                "Transcript"
                            );
                            console.log(
                                "[Background] Created Transcript node:",
                                transcriptNodeId
                            );

                            // Add transcript text as child of Transcript node
                            const transcriptTextNodeId = await addClip(
                                transcriptNodeId,
                                transcript
                            );
                            console.log(
                                "[Background] Added transcript text node:",
                                transcriptTextNodeId
                            );

                            if (tab.id) {
                                await showNotification(
                                    tab.id,
                                    "Saved page with transcript to My Highlights"
                                );
                            }
                        } else {
                            console.log(
                                "[Background] No valid transcript found, not creating Transcript node"
                            );
                            if (tab.id) {
                                await showNotification(
                                    tab.id,
                                    "Saved page to My Highlights"
                                );
                            }
                        }
                    } catch (transcriptError) {
                        console.error(
                            "[Background] All transcript fetching approaches failed:",
                            transcriptError
                        );

                        // Show a detailed error message so we can debug the issue
                        const errorMessage =
                            transcriptError instanceof Error
                                ? transcriptError.message
                                : String(transcriptError);

                        console.error(
                            "[Background] Transcript error details:",
                            errorMessage
                        );

                        // Create a transcript node with the error information for debugging
                        try {
                            const transcriptNodeId = await addClip(
                                articleNodeId,
                                "Transcript (Error Details)"
                            );

                            await addClip(
                                transcriptNodeId,
                                `Transcript extraction failed with error: ${errorMessage}\n\nThis is a debug node to help diagnose the issue.`
                            );

                            console.log(
                                "[Background] Created transcript error debug node:",
                                transcriptNodeId
                            );
                        } catch (debugNodeError) {
                            console.error(
                                "[Background] Failed to create debug node:",
                                debugNodeError
                            );
                        }

                        // Don't create a real transcript node since extraction failed
                        if (tab.id) {
                            await showNotification(
                                tab.id,
                                `Saved page to My Highlights (transcript error: ${errorMessage.substring(
                                    0,
                                    50
                                )}${errorMessage.length > 50 ? "..." : ""})`
                            );
                        }
                    }
                } else {
                    console.log(
                        "[Background] Transcript node already exists, skipping transcript fetch"
                    );

                    if (tab.id) {
                        await showNotification(
                            tab.id,
                            "Saved page to My Highlights"
                        );
                    }
                }
            } catch (error) {
                console.error(
                    "[Background] Error processing YouTube page:",
                    error
                );
                // Continue with normal page save even if transcript fails
                if (tab.id) {
                    await showNotification(
                        tab.id,
                        "Saved page to My Highlights (transcript unavailable)"
                    );
                }
            }
        }

        if (info.menuItemId === "saveSelection" && info.selectionText) {
            console.log("[Background] Saving selection clip.");
            const clipNodeId = await addClip(articleNodeId, info.selectionText);
            console.log("[Mew API] addClip response:", clipNodeId);
            console.log("[Background] Clip saved with node id:", clipNodeId);
            if (tab.id) {
                await showNotification(
                    tab.id,
                    "Selection saved to My Highlights"
                );
            }
        } else if (info.menuItemId === "savePage") {
            console.log("[Background] Saving full page capture.");
            // For full page capture we simply ensure the article node exists
            console.log(
                "[Background] Page saved. Article node id:",
                articleNodeId
            );
            if (tab.id) {
                await showNotification(tab.id, "Page saved to My Highlights");
            }
        }
    } catch (err) {
        console.error("[Background] Error processing context menu click:", err);
        if (tab && tab.id) {
            await showNotification(tab.id, "Error saving to My Highlights");
        }
    }
});

chrome.commands.onCommand.addListener(async (command) => {
    console.log("[Background] Command received:", command);
    if (command === "clipPage") {
        try {
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (!tabs || tabs.length === 0) {
                console.error("[Background] No active tab found.");
                return;
            }
            const tab = tabs[0];
            if (!tab.title || !tab.url) {
                console.error("[Background] Active tab missing title or url.");
                return;
            }

            // Check if we have valid configuration before proceeding
            const { userNodeId, userRootUrl } = await chrome.storage.local.get([
                "userNodeId",
                "userRootUrl",
            ]);
            if (
                !userNodeId ||
                !userRootUrl ||
                !userRootUrl.includes("mew-edge.ideaflow.app")
            ) {
                throw new Error(
                    "Please complete the Mew Web Clipper setup first"
                );
            }

            // Optimistic UI: Show notification immediately
            if (tab.id) {
                await injectNotificationSystem(tab.id);
                await showNotification(
                    tab.id,
                    "Saving page to My Highlights..."
                );
            }

            const myClipsFolderId = await ensureMyClips();
            console.log("[Mew API] ensureMyClips response:", myClipsFolderId);
            const articleNodeId = await getArticleNode(
                tab.title,
                tab.url,
                myClipsFolderId
            );
            console.log("[Mew API] getArticleNode response:", articleNodeId);

            // Handle YouTube video transcript
            if (YouTubeService.isYouTubeVideo(tab.url)) {
                try {
                    const videoId = YouTubeService.extractVideoId(tab.url);
                    if (!videoId) {
                        throw new Error("Failed to extract video ID");
                    }

                    // Check if Transcript node already exists
                    console.log(
                        "[TRANSCRIPT DEBUG] Checking if Transcript node already exists under article node:",
                        articleNodeId
                    );
                    const existingTranscript = await mewApi.findNodeByText({
                        parentNodeId: articleNodeId,
                        nodeText: "Transcript",
                    });
                    console.log(
                        "[TRANSCRIPT DEBUG] Existing transcript node check result:",
                        existingTranscript
                    );

                    // Only create a Transcript node if we can successfully fetch a transcript
                    if (!existingTranscript) {
                        console.log("[Background] Fetching YouTube transcript");
                        console.log(
                            "[TRANSCRIPT DEBUG] No existing transcript node found, will attempt to create one"
                        );

                        try {
                            // First try to get transcript with our multi-approach service
                            let transcript = await youtubeService.getTranscript(
                                videoId
                            );

                            // Check if the result is a caption URL that needs to be fetched
                            if (transcript.startsWith("CAPTION_URL:")) {
                                console.log(
                                    "[Background] Received caption URL from page scraping"
                                );
                                const captionUrl = transcript.substring(
                                    "CAPTION_URL:".length
                                );

                                try {
                                    // Fetch the caption URL
                                    const response = await fetch(captionUrl);
                                    if (response.ok) {
                                        const captionText =
                                            await response.text();

                                        // Parse the XML caption data
                                        if (captionText.includes("<text ")) {
                                            // Simple XML parsing to extract captions
                                            const parser = new DOMParser();
                                            const xmlDoc =
                                                parser.parseFromString(
                                                    captionText,
                                                    "text/xml"
                                                );
                                            const textElements =
                                                xmlDoc.getElementsByTagName(
                                                    "text"
                                                );

                                            let parsedTranscript = "";
                                            for (
                                                let i = 0;
                                                i < textElements.length;
                                                i++
                                            ) {
                                                const element = textElements[i];
                                                const text =
                                                    element.textContent || "";
                                                const start =
                                                    element.getAttribute(
                                                        "start"
                                                    );

                                                if (text.trim() && start) {
                                                    const seconds =
                                                        parseFloat(start);
                                                    const minutes = Math.floor(
                                                        seconds / 60
                                                    );
                                                    const remainingSeconds =
                                                        Math.floor(
                                                            seconds % 60
                                                        );
                                                    const timestamp = `[${minutes
                                                        .toString()
                                                        .padStart(
                                                            2,
                                                            "0"
                                                        )}:${remainingSeconds
                                                        .toString()
                                                        .padStart(2, "0")}]`;

                                                    parsedTranscript += `${timestamp} ${text.trim()}\n`;
                                                }
                                            }

                                            if (parsedTranscript.trim()) {
                                                transcript =
                                                    parsedTranscript.trim();
                                                console.log(
                                                    "[Background] Successfully parsed caption URL data"
                                                );
                                            }
                                        }
                                    }
                                } catch (captionError) {
                                    console.error(
                                        "[Background] Error fetching caption URL:",
                                        captionError
                                    );
                                }
                            }

                            // Only create the Transcript node if we have a valid transcript
                            if (transcript && transcript.trim()) {
                                console.log(
                                    "[TRANSCRIPT DEBUG] Valid transcript received, creating nodes"
                                );
                                console.log(
                                    "[TRANSCRIPT DEBUG] Transcript length:",
                                    transcript.length,
                                    "chars"
                                );
                                console.log(
                                    "[TRANSCRIPT DEBUG] Transcript preview:",
                                    transcript.substring(0, 100) + "..."
                                );

                                // Create Transcript node
                                console.log(
                                    "[TRANSCRIPT DEBUG] Creating parent Transcript node under article:",
                                    articleNodeId
                                );
                                const transcriptNodeId = await addClip(
                                    articleNodeId,
                                    "Transcript"
                                );
                                console.log(
                                    "[Background] Created Transcript node:",
                                    transcriptNodeId
                                );
                                console.log(
                                    "[TRANSCRIPT DEBUG] Parent Transcript node created successfully"
                                );

                                // Add transcript text as child of Transcript node
                                console.log(
                                    "[TRANSCRIPT DEBUG] Adding transcript text as child of Transcript node:",
                                    transcriptNodeId
                                );
                                const transcriptTextNodeId = await addClip(
                                    transcriptNodeId,
                                    transcript
                                );
                                console.log(
                                    "[Background] Added transcript text node:",
                                    transcriptTextNodeId
                                );
                                console.log(
                                    "[TRANSCRIPT DEBUG] Transcript text node created successfully with ID:",
                                    transcriptTextNodeId
                                );

                                if (tab.id) {
                                    await showNotification(
                                        tab.id,
                                        "Saved page with transcript to My Highlights"
                                    );
                                }
                            } else {
                                console.log(
                                    "[Background] No valid transcript found, not creating Transcript node"
                                );
                                if (tab.id) {
                                    await showNotification(
                                        tab.id,
                                        "Saved page to My Highlights"
                                    );
                                }
                            }
                        } catch (transcriptError) {
                            console.error(
                                "[Background] All transcript fetching approaches failed:",
                                transcriptError
                            );

                            // Show a detailed error message so we can debug the issue
                            const errorMessage =
                                transcriptError instanceof Error
                                    ? transcriptError.message
                                    : String(transcriptError);

                            console.error(
                                "[Background] Transcript error details:",
                                errorMessage
                            );

                            // Create a transcript node with the error information for debugging
                            try {
                                const transcriptNodeId = await addClip(
                                    articleNodeId,
                                    "Transcript (Error Details)"
                                );

                                await addClip(
                                    transcriptNodeId,
                                    `Transcript extraction failed with error: ${errorMessage}\n\nThis is a debug node to help diagnose the issue.`
                                );

                                console.log(
                                    "[Background] Created transcript error debug node:",
                                    transcriptNodeId
                                );
                            } catch (debugNodeError) {
                                console.error(
                                    "[Background] Failed to create debug node:",
                                    debugNodeError
                                );
                            }

                            // Don't create a real transcript node since extraction failed
                            if (tab.id) {
                                await showNotification(
                                    tab.id,
                                    `Saved page to My Highlights (transcript error: ${errorMessage.substring(
                                        0,
                                        50
                                    )}${errorMessage.length > 50 ? "..." : ""})`
                                );
                            }
                        }
                    } else {
                        console.log(
                            "[Background] Transcript node already exists, skipping transcript fetch"
                        );
                        if (tab.id) {
                            await showNotification(
                                tab.id,
                                "Page saved to My Highlights"
                            );
                        }
                    }
                } catch (error) {
                    console.error(
                        "[Background] Error processing YouTube transcript:",
                        error
                    );
                    // Continue with normal page save even if transcript fails
                    if (tab.id) {
                        await showNotification(
                            tab.id,
                            "Saved page to My Highlights (transcript unavailable)"
                        );
                    }
                }
            } else {
                console.log(
                    "[Background] Page captured via keyboard shortcut. Article node id:",
                    articleNodeId
                );
                if (tab.id) {
                    await showNotification(
                        tab.id,
                        "Page saved to My Highlights"
                    );
                }
            }
        } catch (err) {
            console.error(
                "[Background] Error processing clipPage command:",
                err
            );
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (tabs && tabs[0] && tabs[0].id) {
                await showNotification(
                    tabs[0].id,
                    "Error saving page to My Highlights"
                );
            }
        }
    }
});

// Export the functionality
export { injectNotificationSystem, showNotification };
