import { MewAPI, parseNodeIdFromUrl } from "./MewService.js";
import { Logger } from "./utils/logger.js";
const logger = new Logger("MewClipper");
async function getStorageValue(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            }
            else {
                resolve(result[key]);
            }
        });
    });
}
async function setStorageValue(key, value) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            }
            else {
                resolve();
            }
        });
    });
}
export const mewApi = new MewAPI();
async function getUserId() {
    const stored = await getStorageValue("userNodeId");
    if (!stored) {
        throw new Error("User node id not found in storage. Please complete setup properly.");
    }
    let decoded = decodeURIComponent(stored);
    decoded = decoded.replace(/%7C/gi, "|");
    return decoded;
}
const myClipsFolderName = "My Highlights";
export async function ensureMyClips() {
    console.log("[MewClipper] Starting search for folder:", myClipsFolderName);
    const userRootUrl = await getStorageValue("userRootUrl");
    if (!userRootUrl) {
        console.error("[MewClipper] User root URL not found in storage.");
        throw new Error("User root URL is required for setup");
    }
    console.log("[MewClipper] Retrieved user root URL:", userRootUrl);
    let rootNodeId;
    try {
        const urlObj = new URL(userRootUrl);
        if (!urlObj.hostname.includes("mew-edge.ideaflow.app")) {
            throw new Error("Invalid URL: Must be from mew-edge.ideaflow.app");
        }
        rootNodeId = parseNodeIdFromUrl(userRootUrl);
        if (!rootNodeId) {
            throw new Error("Failed to extract root node ID from URL");
        }
        console.log("[MewClipper] Extracted root node ID:", rootNodeId);
    }
    catch (error) {
        console.error("[MewClipper] Invalid user root URL stored:", userRootUrl, "Error:", error);
        throw new Error("Invalid user root URL format. Please provide a correct user node URL.");
    }
    console.log(`[MewClipper] Searching for folder with exact name '${myClipsFolderName}' under root node '${rootNodeId}'`);
    const existingNode = await mewApi.findNodeByText({
        parentNodeId: rootNodeId,
        nodeText: myClipsFolderName,
    });
    if (existingNode) {
        console.log(`[MewClipper] Found existing ${myClipsFolderName} folder with id:`, existingNode.id);
        return existingNode.id;
    }
    console.log(`[MewClipper] Creating '${myClipsFolderName}' folder under the root node.`);
    const response = await mewApi.addNode({
        content: { type: "text", text: myClipsFolderName },
        parentNodeId: rootNodeId,
        authorId: await getUserId(),
    });
    const newClipsFolderId = response.newNodeId;
    console.log(`[MewClipper] '${myClipsFolderName}' folder created with id:`, newClipsFolderId);
    console.log("[MewClipper] Node URL:", mewApi.getNodeUrl(response.newNodeId));
    return newClipsFolderId;
}
export async function getArticleNode(title, url, myClipsFolderId) {
    const storageKey = "articleNodes";
    let articleNodes = (await getStorageValue(storageKey)) ||
        {};
    if (articleNodes[url]) {
        console.log("[MewClipper] Found potential existing article node for url:", url);
        const { childNodes } = await mewApi.getChildNodes({
            parentNodeId: myClipsFolderId,
        });
        const isStillChild = childNodes.some((node) => node.id === articleNodes[url]);
        if (isStillChild) {
            console.log("[MewClipper] Verified article node is still a child of My Highlights");
            return articleNodes[url];
        }
        console.log("[MewClipper] Article node no longer a child of My Highlights, creating new one");
    }
    console.log("[MewClipper] Creating new article node for", title);
    const response = await mewApi.addNode({
        content: { type: "text", text: title },
        parentNodeId: myClipsFolderId,
        authorId: await getUserId(),
    });
    const articleNodeId = response.newNodeId;
    await mewApi.addNode({
        content: { type: "text", text: url },
        parentNodeId: articleNodeId,
        relationLabel: "url",
        authorId: await getUserId(),
    });
    articleNodes[url] = articleNodeId;
    await setStorageValue(storageKey, articleNodes);
    console.log("[MewClipper] Node URL:", mewApi.getNodeUrl(response.newNodeId));
    return articleNodeId;
}
export async function addClip(articleNodeId, clipText) {
    console.log("[MewClipper] Adding clip to article node:", articleNodeId);
    const response = await mewApi.addNode({
        content: { type: "text", text: clipText },
        parentNodeId: articleNodeId,
        authorId: await getUserId(),
    });
    console.log("[MewClipper] Created clip node with id:", response.newNodeId);
    console.log("[MewClipper] Node URL:", mewApi.getNodeUrl(response.newNodeId));
    return response.newNodeId;
}
