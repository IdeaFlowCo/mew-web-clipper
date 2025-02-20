function getStorageValue(key) {
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
function setStorageValue(key, value) {
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
function generateId() {
    return "node-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}
export async function createNode(parentNodeId, content) {
    console.log(`[MewClipper] Creating node under parent ${parentNodeId} with content: ${content}`);
    const nodeId = generateId();
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`[MewClipper] Created node with id: ${nodeId}`);
    return nodeId;
}
export async function ensureMyClips() {
    const storageKey = "myClipsFolderId";
    let myClipsFolderId = await getStorageValue(storageKey);
    if (myClipsFolderId) {
        console.log("[MewClipper] My Clips folder already exists with id:", myClipsFolderId);
        return myClipsFolderId;
    }
    console.log("[MewClipper] My Clips folder does not exist. Creating one.");
    const userRootId = "userRoot";
    myClipsFolderId = await createNode(userRootId, "My Clips");
    await setStorageValue(storageKey, myClipsFolderId);
    return myClipsFolderId;
}
export async function getArticleNode(title, url, myClipsFolderId) {
    const storageKey = "articleNodes";
    let articleNodes = (await getStorageValue(storageKey)) ||
        {};
    if (articleNodes[url]) {
        console.log("[MewClipper] Found existing article node for url:", url);
        return articleNodes[url];
    }
    console.log("[MewClipper] Creating new article node for", title);
    const articleNodeId = await createNode(myClipsFolderId, title);
    const urlContent = `url::${url}`;
    await createNode(articleNodeId, urlContent);
    articleNodes[url] = articleNodeId;
    await setStorageValue(storageKey, articleNodes);
    return articleNodeId;
}
export async function addClip(articleNodeId, clipText) {
    console.log("[MewClipper] Adding clip to article node:", articleNodeId);
    const clipNodeId = await createNode(articleNodeId, clipText);
    return clipNodeId;
}
