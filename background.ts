/* background.ts - Background script for Mew Web Clipper extension */

import { ensureMyClips, getArticleNode, addClip } from "./mewClipper.js";

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

        if (info.menuItemId === "saveSelection" && info.selectionText) {
            console.log("[Background] Saving selection clip.");
            const clipNodeId = await addClip(articleNodeId, info.selectionText);
            console.log("[Mew API] addClip response:", clipNodeId);
            console.log("[Background] Clip saved with node id:", clipNodeId);
        } else if (info.menuItemId === "savePage") {
            console.log("[Background] Saving full page capture.");
            // For full page capture we simply ensure the article node exists
            console.log(
                "[Background] Page saved. Article node id:",
                articleNodeId
            );
        }
    } catch (err) {
        console.error("[Background] Error processing context menu click:", err);
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

            const myClipsFolderId = await ensureMyClips();
            console.log("[Mew API] ensureMyClips response:", myClipsFolderId);
            const articleNodeId = await getArticleNode(
                tab.title,
                tab.url,
                myClipsFolderId
            );
            console.log("[Mew API] getArticleNode response:", articleNodeId);
            console.log(
                "[Background] Page captured via keyboard shortcut. Article node id:",
                articleNodeId
            );
        } catch (err) {
            console.error(
                "[Background] Error processing clipPage command:",
                err
            );
        }
    }
});

// Ensure module scoping for ES module interpretation
export {};
