"use strict";
console.log("[Background] Mew Web Clipper extension background initialized.");
chrome.runtime.onInstalled.addListener(() => {
    console.log("[Background] onInstalled event fired. Creating context menu items.");
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
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("[Background] Context menu clicked. Info:", info);
    if (!tab || !tab.id) {
        console.error("[Background] No tab information available.");
        return;
    }
    try {
        const { ensureMyClips, getArticleNode, addClip } = await import("./mewClipper.js");
        const myClipsFolderId = await ensureMyClips();
        if (!tab.title || !tab.url) {
            console.error("[Background] Tab missing title or url.");
            return;
        }
        const articleNodeId = await getArticleNode(tab.title, tab.url, myClipsFolderId);
        if (info.menuItemId === "saveSelection" && info.selectionText) {
            console.log("[Background] Saving selection clip.");
            const clipNodeId = await addClip(articleNodeId, info.selectionText);
            console.log("[Background] Clip saved with node id:", clipNodeId);
        }
        else if (info.menuItemId === "savePage") {
            console.log("[Background] Saving full page capture.");
            console.log("[Background] Page saved. Article node id:", articleNodeId);
        }
    }
    catch (err) {
        console.error("[Background] Error processing context menu click:", err);
    }
});
chrome.commands.onCommand.addListener(async (command) => {
    console.log("[Background] Command received:", command);
    if (command === "clipPage") {
        try {
            const { ensureMyClips, getArticleNode } = await import("./mewClipper.js");
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
            const myClipsFolderId = await ensureMyClips();
            const articleNodeId = await getArticleNode(tab.title, tab.url, myClipsFolderId);
            console.log("[Background] Page captured via keyboard shortcut. Article node id:", articleNodeId);
        }
        catch (err) {
            console.error("[Background] Error processing clipPage command:", err);
        }
    }
});
