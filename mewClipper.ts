/* mewClipper.ts - Integrated with the real Mew API */
// in the future we will want to update this such that it handles login --
// the user logs in w the same account they use for Mew, and then we
// automatically grab the url to their user node using some lookup table

import { MewAPI, parseNodeIdFromUrl } from "./MewService.js";

// Helper functions for chrome.storage access
async function getStorageValue(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result[key]);
            }
        });
    });
}

async function setStorageValue(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

const mewApi = new MewAPI();

// Add this helper function after setStorageValue
async function getUserId(): Promise<string> {
    const stored = await getStorageValue("userNodeId");
    if (!stored) {
        throw new Error(
            "User node id not found in storage. Please complete setup properly."
        );
    }
    // Decode the stored value
    let decoded = decodeURIComponent(stored);
    // Replace any occurrence of '%7C' (case-insensitive) with the pipe character '|'
    decoded = decoded.replace(/%7C/gi, "|");
    return decoded;
}

// Define a variable for the node name to allow easy changes
const myClipsFolderName = "My Highlights";

/* ensureMyClips: Checks whether the "My Clips" folder is cached in storage.
 * If not, it retrieves the user node id (saved during setup) and calls MewAPI.addNode
 * to create a node with content "My Clips" under the user's node. The new node id is cached and returned.
 */
export async function ensureMyClips(): Promise<string> {
    console.log("[MewClipper] Starting search for folder:", myClipsFolderName);

    // Get user's root URL and extract node ID
    const userRootUrl = await getStorageValue("userRootUrl");
    if (!userRootUrl) {
        console.error("[MewClipper] User root URL not found in storage.");
        throw new Error("User root URL is required for setup");
    }
    console.log("[MewClipper] Retrieved user root URL:", userRootUrl);

    let rootNodeId: string;
    try {
        // Validate URL format first
        const urlObj = new URL(userRootUrl);
        if (!urlObj.hostname.includes("mew-edge.ideaflow.app")) {
            throw new Error("Invalid URL: Must be from mew-edge.ideaflow.app");
        }

        rootNodeId = parseNodeIdFromUrl(userRootUrl);
        if (!rootNodeId) {
            throw new Error("Failed to extract root node ID from URL");
        }
        console.log("[MewClipper] Extracted root node ID:", rootNodeId);
    } catch (error) {
        console.error(
            "[MewClipper] Invalid user root URL stored:",
            userRootUrl,
            "Error:",
            error
        );
        throw new Error(
            "Invalid user root URL format. Please provide a correct user node URL."
        );
    }

    // Look for existing node folder under root node
    console.log(
        `[MewClipper] Searching for folder with exact name '${myClipsFolderName}' under root node '${rootNodeId}'`
    );
    const existingNode = await mewApi.findNodeByText({
        parentNodeId: rootNodeId,
        nodeText: myClipsFolderName,
    });

    if (existingNode) {
        console.log(
            `[MewClipper] Found existing ${myClipsFolderName} folder with id:`,
            existingNode.id
        );
        return existingNode.id;
    }

    // Create new node folder if it doesn't exist
    console.log(
        `[MewClipper] Creating '${myClipsFolderName}' folder under the root node.`
    );
    const response = await mewApi.addNode({
        content: { type: "text", text: myClipsFolderName },
        parentNodeId: rootNodeId,
        authorId: await getUserId(),
    });

    const newClipsFolderId = response.newNodeId;
    console.log(
        `[MewClipper] '${myClipsFolderName}' folder created with id:`,
        newClipsFolderId
    );
    // After creating a new node, log its URL
    console.log(
        "[MewClipper] Node URL:",
        mewApi.getNodeUrl(response.newNodeId)
    );
    return newClipsFolderId;
}

/* getArticleNode: Retrieves (and caches) an article node for the given page.
 * If an article node for the given URL exists in storage, it is returned;
 * otherwise, a new article node is created under the My Clips folder with the page title as content.
 * An additional child node storing the URL is added for reference.
 */
export async function getArticleNode(
    title: string,
    url: string,
    myClipsFolderId: string
): Promise<string> {
    const storageKey = "articleNodes";
    let articleNodes =
        ((await getStorageValue(storageKey)) as { [key: string]: string }) ||
        {};
    if (articleNodes[url]) {
        console.log(
            "[MewClipper] Found potential existing article node for url:",
            url
        );
        // Verify the node is still a direct child of My Highlights
        const { childNodes } = await mewApi.getChildNodes({
            parentNodeId: myClipsFolderId,
        });
        const isStillChild = childNodes.some(
            (node) => node.id === articleNodes[url]
        );
        if (isStillChild) {
            console.log(
                "[MewClipper] Verified article node is still a child of My Highlights"
            );
            return articleNodes[url];
        }
        console.log(
            "[MewClipper] Article node no longer a child of My Highlights, creating new one"
        );
    }
    console.log("[MewClipper] Creating new article node for", title);
    const response = await mewApi.addNode({
        content: { type: "text", text: title },
        parentNodeId: myClipsFolderId,
        authorId: await getUserId(),
    });
    const articleNodeId = response.newNodeId;
    // Create an additional child node to store the URL for reference.
    await mewApi.addNode({
        content: { type: "text", text: url },
        parentNodeId: articleNodeId,
        relationLabel: "url",
        authorId: await getUserId(),
    });
    articleNodes[url] = articleNodeId;
    await setStorageValue(storageKey, articleNodes);
    // After creating a new node, log its URL
    console.log(
        "[MewClipper] Node URL:",
        mewApi.getNodeUrl(response.newNodeId)
    );
    return articleNodeId;
}

/* addClip: Adds a clip (text) as a child node under the specified article node using the real Mew API.
 * Returns the created clip's node id.
 */
export async function addClip(
    articleNodeId: string,
    clipText: string
): Promise<string> {
    console.log("[MewClipper] Adding clip to article node:", articleNodeId);
    const response = await mewApi.addNode({
        content: { type: "text", text: clipText },
        parentNodeId: articleNodeId,
        authorId: await getUserId(),
    });
    console.log("[MewClipper] Created clip node with id:", response.newNodeId);
    // After creating a new node, log its URL
    console.log(
        "[MewClipper] Node URL:",
        mewApi.getNodeUrl(response.newNodeId)
    );
    return response.newNodeId;
}
