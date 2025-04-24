var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// utils/logger.ts
var Logger = class {
  constructor(context) {
    __publicField(this, "context");
    this.context = context;
  }
  info(...args) {
    console.log(`[INFO] [${this.context}]`, ...args);
  }
  error(...args) {
    console.error(`[ERROR] [${this.context}]`, ...args);
  }
};

// MewService.ts
var AUTH_CONFIG = {
  baseUrl: "https://mew-edge.ideaflow.app/api",
  baseNodeUrl: "https://mew-edge.ideaflow.app/",
  auth0Domain: "ideaflow-mew-dev.us.auth0.com",
  auth0ClientId: "zbhouY8SmHtIIJSjt1gu8TR3FgMsgo3J",
  auth0ClientSecret: "x0SAiFCCMwfgNEzU29KFh3TR4sTWuQVDqrRwBWCe0KsbA7WEd-1Ypatb47LCQ_Xb",
  auth0Audience: "https://ideaflow-mew-dev.us.auth0.com/api/v2/"
  // userId: "auth0|6793c6489ed96468672bae93",
  // userId: "auth0|67b00414a18956f5273397da", // cody+mewagent@ideaflow.io
};
var logger = new Logger("MewService");
function createNodeContent(content) {
  if (Array.isArray(content)) {
    return content;
  }
  if (content.type === "text" /* Text */) {
    return [{ type: "text", value: content.text, styles: 0 }];
  } else if (content.type === "text" && content.text) {
    return [{ type: "text", value: content.text, styles: 0 }];
  } else if (content.type === "mention" /* Mention */) {
    return [
      {
        type: "text",
        value: content.mentionData.preMentionText,
        styles: 0
      },
      {
        type: "mention",
        value: content.mentionData.mentionNodeId,
        mentionTrigger: "@"
      },
      {
        type: "text",
        value: content.mentionData.postMentionText,
        styles: 0
      }
    ];
  } else if (content.type === "replacement" /* Replacement */) {
    return [{ type: "text", value: "replacement", styles: 0 }];
  }
  return [{ type: "text", value: "", styles: 0 }];
}
var MewAPI = class {
  constructor() {
    __publicField(this, "baseUrl");
    __publicField(this, "baseNodeUrl");
    __publicField(this, "token");
    __publicField(this, "currentUserId");
    this.baseUrl = AUTH_CONFIG.baseUrl;
    this.baseNodeUrl = AUTH_CONFIG.baseNodeUrl;
    this.token = "";
    this.currentUserId = "";
  }
  setCurrentUserId(userId) {
    this.currentUserId = userId;
  }
  getCurrentUser() {
    return { id: this.currentUserId };
  }
  uuid() {
    return crypto.randomUUID();
  }
  async getAccessToken() {
    try {
      const response = await fetch(
        `https://${AUTH_CONFIG.auth0Domain}/oauth/token`,
        {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            client_id: AUTH_CONFIG.auth0ClientId,
            client_secret: AUTH_CONFIG.auth0ClientSecret,
            audience: AUTH_CONFIG.auth0Audience,
            grant_type: "client_credentials"
          })
        }
      );
      if (!response.ok) {
        throw new Error(`Auth failed: ${response.statusText}`);
      }
      const data = await response.json();
      this.token = data.access_token;
    } catch (error) {
      if (error instanceof Error) {
        logger.error("Failed to fetch access token:", error);
      } else {
        logger.error("Failed to fetch access token: Unknown error");
      }
      this.token = "dummy-access-token";
    }
    return this.token;
  }
  async addNode(input) {
    const { content, parentNodeId, relationLabel, isChecked, authorId } = input;
    const nodeContent = createNodeContent(content);
    const usedAuthorId = authorId ?? this.currentUserId;
    const newNodeId = this.uuid();
    const parentChildRelationId = this.uuid();
    const transactionId = this.uuid();
    const timestamp = Date.now();
    let relationLabelNodeId = "";
    const updates = [];
    updates.push({
      operation: "addNode",
      node: {
        version: 1,
        id: newNodeId,
        authorId: usedAuthorId,
        createdAt: timestamp,
        updatedAt: timestamp,
        content: nodeContent,
        isPublic: true,
        isNewRelatedObjectsPublic: false,
        canonicalRelationId: parentNodeId ? parentChildRelationId : null,
        isChecked: isChecked ?? null
      }
    });
    if (parentNodeId) {
      updates.push({
        operation: "addRelation",
        relation: {
          version: 1,
          id: parentChildRelationId,
          authorId: usedAuthorId,
          createdAt: timestamp,
          updatedAt: timestamp,
          fromId: parentNodeId,
          toId: newNodeId,
          relationTypeId: "child",
          isPublic: true,
          canonicalRelationId: null
        },
        fromPos: { int: timestamp, frac: "a0" },
        toPos: { int: timestamp, frac: "a0" }
      });
      updates.push({
        operation: "updateRelationList",
        relationId: parentChildRelationId,
        oldPosition: null,
        newPosition: { int: timestamp, frac: "a0" },
        authorId: usedAuthorId,
        type: "all",
        oldIsPublic: true,
        newIsPublic: true,
        nodeId: parentNodeId,
        relatedNodeId: newNodeId
      });
    }
    if (relationLabel) {
      relationLabelNodeId = this.uuid();
      updates.push({
        operation: "addNode",
        node: {
          version: 1,
          id: relationLabelNodeId,
          authorId: usedAuthorId,
          createdAt: timestamp,
          updatedAt: timestamp,
          content: [
            { type: "text", value: relationLabel, styles: 0 }
          ],
          isPublic: true,
          isNewRelatedObjectsPublic: false,
          canonicalRelationId: null,
          isChecked: null
        }
      });
      const newRelationTypeId = this.uuid();
      updates.push({
        operation: "addRelation",
        relation: {
          version: 1,
          id: newRelationTypeId,
          authorId: usedAuthorId,
          createdAt: timestamp,
          updatedAt: timestamp,
          fromId: parentChildRelationId,
          toId: relationLabelNodeId,
          relationTypeId: "__type__",
          isPublic: true,
          canonicalRelationId: null
        },
        fromPos: { int: timestamp, frac: "a0" },
        toPos: { int: timestamp, frac: "a0" }
      });
      updates.push({
        operation: "updateRelationList",
        relationId: newRelationTypeId,
        oldPosition: null,
        newPosition: { int: timestamp, frac: "a0" },
        authorId: usedAuthorId,
        type: "all",
        oldIsPublic: true,
        newIsPublic: true,
        nodeId: parentChildRelationId,
        relatedNodeId: relationLabelNodeId
      });
      updates.push({
        operation: "updateRelation",
        oldProps: {
          version: 1,
          id: parentChildRelationId,
          authorId: usedAuthorId,
          createdAt: timestamp,
          updatedAt: timestamp,
          fromId: parentNodeId,
          toId: newNodeId,
          relationTypeId: "child",
          isPublic: true,
          canonicalRelationId: null
        },
        newProps: {
          version: 1,
          id: parentChildRelationId,
          authorId: usedAuthorId,
          createdAt: timestamp,
          updatedAt: timestamp,
          fromId: parentNodeId,
          toId: newNodeId,
          relationTypeId: "child",
          isPublic: true,
          canonicalRelationId: newRelationTypeId
        }
      });
    }
    if (content?.type === "Replacement" && content.replacementNodeData) {
      updates.push({
        operation: "updateRelation",
        oldProps: {
          version: 1,
          id: parentChildRelationId,
          authorId: usedAuthorId,
          createdAt: timestamp,
          updatedAt: timestamp,
          fromId: parentNodeId,
          toId: newNodeId,
          relationTypeId: "child",
          isPublic: true,
          canonicalRelationId: null
        },
        newProps: {
          version: 1,
          id: parentChildRelationId,
          authorId: usedAuthorId,
          createdAt: timestamp,
          updatedAt: timestamp,
          fromId: parentNodeId,
          toId: content.replacementNodeData.referenceNodeId,
          relationTypeId: "child",
          isPublic: true,
          canonicalRelationId: content.replacementNodeData.referenceCanonicalRelationId
        }
      });
      updates.push({
        operation: "updateRelationList",
        relationId: parentChildRelationId,
        oldPosition: null,
        newPosition: { int: timestamp, frac: "a0" },
        authorId: usedAuthorId,
        type: "all",
        oldIsPublic: true,
        newIsPublic: true,
        nodeId: parentNodeId,
        relatedNodeId: content.replacementNodeData.referenceNodeId
      });
    }
    const token = await this.getAccessToken();
    const payload = {
      clientId: AUTH_CONFIG.auth0ClientId,
      userId: usedAuthorId,
      transactionId,
      updates
    };
    const txResponse = await fetch(`${this.baseUrl}/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!txResponse.ok) {
      const responseText = await txResponse.text();
      const errMsg = `Failed to add node: Status ${txResponse.status} ${txResponse.statusText}. Response: ${responseText}`;
      logger.error(errMsg);
      logger.error("Request payload was:", payload);
      throw new Error(errMsg);
    }
    if (txResponse.ok && isChecked) {
    }
    return {
      newNodeId,
      newRelationLabelNodeId: relationLabelNodeId,
      parentChildRelationId,
      referenceNodeId: content?.type === "Replacement" && content.replacementNodeData ? content.replacementNodeData.referenceNodeId : "",
      referenceCanonicalRelationId: content?.type === "Replacement" && content.replacementNodeData ? content.replacementNodeData.referenceCanonicalRelationId : "",
      isChecked: isChecked ?? void 0
    };
  }
  async syncData() {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to sync data: ${response.statusText}`);
    }
    return response.json();
  }
  async getLayerData(objectIds) {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/layer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ objectIds })
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch layer data: ${response.statusText}`
      );
    }
    const layerData = await response.json();
    return layerData;
  }
  /**
   * Finds a node with exact text match under a parent node
   * @returns The matching node or undefined
   */
  async findNodeByText({
    parentNodeId,
    nodeText
  }) {
    const { parentNode, childNodes } = await this.getChildNodes({
      parentNodeId
    });
    console.log(
      "findNodeByText: searching for exact text match:",
      nodeText
    );
    console.log(
      "findNodeByText: child nodes content:",
      childNodes.filter((node2) => node2).map((node2) => ({
        id: node2.id,
        content: node2.content,
        textValue: node2.content?.[0]?.value
      }))
    );
    const node = childNodes.find(
      (node2) => node2 && node2.content && node2.content.length > 0 && node2.content[0].value === nodeText
    );
    console.log("findNodeByText: found node:", {
      searchedFor: nodeText,
      foundNodeContent: node?.content?.[0]?.value,
      node
    });
    return node;
  }
  async getChildNodes({
    parentNodeId
  }) {
    const layerData = await this.getLayerData([parentNodeId]);
    const parentNode = layerData.data.nodesById[parentNodeId];
    const childRelations = Object.values(
      layerData.data.relationsById
    ).filter(
      (relation) => relation !== null && typeof relation === "object" && "fromId" in relation && "toId" in relation && "relationTypeId" in relation && relation.fromId === parentNodeId && relation.relationTypeId === "child"
    );
    const childNodes = childRelations.map((relation) => {
      const nodeData = layerData.data.nodesById[relation.toId];
      return nodeData;
    });
    return {
      parentNode,
      childNodes
    };
  }
  getNodeUrl(nodeId) {
    return `${this.baseUrl}/g/all/global-root-to-users/all/users-to-user-relation-id/${nodeId}`;
  }
};
var parseNodeIdFromUrl = (url) => {
  const regex = /^https?:\/\/mew-edge\.ideaflow\.app\/g\/all\/global-root-to-users\/all\/users-to-user-relation-id-[^\/]+\/user-root-id-[^\/]+$/;
  if (!regex.test(url)) {
    throw new Error("Invalid user node URL format");
  }
  const urlParts = url.split("/");
  const lastPart = urlParts[urlParts.length - 1];
  let decoded = lastPart.replace(/%7C/gi, "|");
  decoded = decodeURIComponent(decoded);
  decoded = decoded.replace(/%7C/gi, "|");
  return decoded;
};

// mewClipper.ts
var logger2 = new Logger("MewClipper");
async function getStorageValue(key) {
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
async function setStorageValue(key, value) {
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
var mewApi = new MewAPI();
async function getUserId() {
  const stored = await getStorageValue("userNodeId");
  if (!stored) {
    throw new Error(
      "User node id not found in storage. Please complete setup properly."
    );
  }
  let decoded = decodeURIComponent(stored);
  decoded = decoded.replace(/%7C/gi, "|");
  return decoded;
}
var myClipsFolderName = "My Highlights";
async function ensureMyClips() {
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
  console.log(
    `[MewClipper] Searching for folder with exact name '${myClipsFolderName}' under root node '${rootNodeId}'`
  );
  const existingNode = await mewApi.findNodeByText({
    parentNodeId: rootNodeId,
    nodeText: myClipsFolderName
  });
  if (existingNode) {
    console.log(
      `[MewClipper] Found existing ${myClipsFolderName} folder with id:`,
      existingNode.id
    );
    return existingNode.id;
  }
  console.log(
    `[MewClipper] Creating '${myClipsFolderName}' folder under the root node.`
  );
  const response = await mewApi.addNode({
    content: { type: "text", text: myClipsFolderName },
    parentNodeId: rootNodeId,
    authorId: await getUserId()
  });
  const newClipsFolderId = response.newNodeId;
  console.log(
    `[MewClipper] '${myClipsFolderName}' folder created with id:`,
    newClipsFolderId
  );
  console.log(
    "[MewClipper] Node URL:",
    mewApi.getNodeUrl(response.newNodeId)
  );
  return newClipsFolderId;
}
async function getArticleNode(title, url, myClipsFolderId) {
  const storageKey = "articleNodes";
  let articleNodes = await getStorageValue(storageKey) || {};
  if (articleNodes[url]) {
    console.log(
      "[MewClipper] Found potential existing article node for url:",
      url
    );
    const { childNodes } = await mewApi.getChildNodes({
      parentNodeId: myClipsFolderId
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
    authorId: await getUserId()
  });
  const articleNodeId = response.newNodeId;
  await mewApi.addNode({
    content: { type: "text", text: url },
    parentNodeId: articleNodeId,
    relationLabel: "url",
    authorId: await getUserId()
  });
  articleNodes[url] = articleNodeId;
  await setStorageValue(storageKey, articleNodes);
  console.log(
    "[MewClipper] Node URL:",
    mewApi.getNodeUrl(response.newNodeId)
  );
  return articleNodeId;
}
async function addClip(articleNodeId, clipText) {
  console.log("[MewClipper] Adding clip to article node:", articleNodeId);
  const response = await mewApi.addNode({
    content: { type: "text", text: clipText },
    parentNodeId: articleNodeId,
    authorId: await getUserId()
  });
  console.log("[MewClipper] Created clip node with id:", response.newNodeId);
  console.log(
    "[MewClipper] Node URL:",
    mewApi.getNodeUrl(response.newNodeId)
  );
  return response.newNodeId;
}

// services/YouTubeService.ts
var _YouTubeService = class _YouTubeService {
  constructor() {
    this.loadApiKey();
  }
  /**
   * Logs debugging information when DEBUG is enabled
   */
  static debugLog(message, data) {
    if (_YouTubeService.DEBUG) {
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
  static errorLog(message, error) {
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
  static infoLog(message, data) {
    console.log(`[YouTubeService INFO] ${message}`);
    if (data) {
      console.log(`[YouTubeService INFO] Data:`, data);
    }
  }
  /**
   * Loads the YouTube API key from Chrome storage
   */
  async loadApiKey() {
    try {
      const result = await chrome.storage.local.get("youtubeApiKey");
      if (result && result.youtubeApiKey) {
        _YouTubeService.API_KEY = result.youtubeApiKey;
        _YouTubeService.debugLog("Loaded API key from storage");
      } else {
        _YouTubeService.debugLog("No API key found in storage");
      }
    } catch (error) {
      console.error("[YouTubeService] Error loading API key:", error);
    }
  }
  /**
   * Sets the YouTube API key and stores it in Chrome storage
   */
  async setApiKey(apiKey) {
    try {
      _YouTubeService.API_KEY = apiKey;
      await chrome.storage.local.set({ youtubeApiKey: apiKey });
      _YouTubeService.debugLog("API key saved to storage");
    } catch (error) {
      console.error("[YouTubeService] Error saving API key:", error);
      throw new Error(`Failed to save API key: ${error}`);
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
  static extractVideoId(url) {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === "youtu.be") {
        return urlObj.pathname.slice(1);
      }
      if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtube-nocookie.com")) {
        const searchParams = new URLSearchParams(urlObj.search);
        const videoId = searchParams.get("v");
        if (videoId) return videoId;
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
  static isYouTubeVideo(url) {
    return !!_YouTubeService.extractVideoId(url);
  }
  /**
   * Main method to fetch transcript for a YouTube video
   * Uses browser-based scraping
   */
  async getTranscript(videoId) {
    _YouTubeService.infoLog(
      `Starting transcript fetch for video ID: ${videoId}`
    );
    _YouTubeService.infoLog(
      `Video URL: https://www.youtube.com/watch?v=${videoId}`
    );
    console.log("[TRANSCRIPT DEBUG] Starting transcript fetch process");
    return await this.extractTranscriptWithBrowserScraping(videoId);
  }
  /**
   * Extract transcript by injecting a content script that scrapes the YouTube page
   */
  async extractTranscriptWithBrowserScraping(videoId) {
    _YouTubeService.infoLog(
      "Starting browser-based transcript extraction for video ID: " + videoId
    );
    console.log("[TRANSCRIPT DEBUG] Browser-based extraction started");
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found to perform browser scraping");
    }
    const tab = tabs[0];
    let isOnCorrectPage = false;
    if (tab.url && _YouTubeService.isYouTubeVideo(tab.url)) {
      const currentVideoId = _YouTubeService.extractVideoId(tab.url);
      isOnCorrectPage = currentVideoId === videoId;
    }
    if (!isOnCorrectPage) {
      _YouTubeService.infoLog(
        "Current tab is not on the target YouTube video, navigating to it"
      );
      if (!tab.id) {
        throw new Error("Tab ID is undefined, cannot navigate");
      }
      try {
        console.log(
          "[TRANSCRIPT DEBUG] Navigating to YouTube video page"
        );
        await chrome.tabs.update(tab.id, {
          url: `https://www.youtube.com/watch?v=${videoId}`
        });
        await new Promise((resolve) => setTimeout(resolve, 3e3));
        console.log(
          "[TRANSCRIPT DEBUG] Navigation complete, waited 3s for page to load"
        );
      } catch (error) {
        _YouTubeService.errorLog(
          "Failed to navigate to YouTube video:",
          error
        );
        throw new Error("Failed to navigate to YouTube video page");
      }
    } else {
      console.log(
        "[TRANSCRIPT DEBUG] Already on correct YouTube video page"
      );
    }
    if (!tab.id) {
      throw new Error(
        "Tab ID is undefined, cannot inject content script"
      );
    }
    try {
      console.log(
        "[TRANSCRIPT DEBUG] Injecting content script to extract transcript"
      );
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function() {
          console.log(
            "[Transcript Extractor] Starting transcript extraction from page"
          );
          console.log(
            "[TRANSCRIPT DEBUG][Content Script] Starting transcript extraction"
          );
          try {
            const findTranscriptButton = () => {
              const menuButtons = Array.from(
                document.querySelectorAll("button")
              );
              console.log(
                "[TRANSCRIPT DEBUG][Content Script] Found " + menuButtons.length + " buttons on the page"
              );
              if (menuButtons.length > 0) {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] Button texts sample: " + menuButtons.slice(
                    0,
                    Math.min(5, menuButtons.length)
                  ).map(
                    (b) => b.textContent || "empty"
                  ).join(", ")
                );
              }
              const transcriptButton2 = menuButtons.find(
                (button) => button.textContent?.includes(
                  "Show transcript"
                ) || button.textContent?.includes(
                  "Open transcript"
                )
              );
              if (transcriptButton2) {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] Found transcript button with text: " + (transcriptButton2.textContent || "empty")
                );
              } else {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] No transcript button found"
                );
              }
              return transcriptButton2;
            };
            const transcriptButton = findTranscriptButton();
            if (transcriptButton) {
              console.log(
                "[TRANSCRIPT DEBUG][Content Script] Clicking transcript button"
              );
              transcriptButton.click();
              setTimeout(() => {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] Waited for transcript to load"
                );
              }, 1e3);
            } else {
              console.log(
                "[TRANSCRIPT DEBUG][Content Script] No transcript button found, will try to find transcript panel directly"
              );
            }
            const transcriptPanel = document.querySelector("ytd-transcript-renderer") || document.querySelector('[id="transcript-panel"]') || document.querySelector('[id="transcript"]');
            console.log(
              "[TRANSCRIPT DEBUG][Content Script] Transcript panel found: " + (transcriptPanel ? "Yes" : "No")
            );
            if (transcriptPanel) {
              console.log(
                "[TRANSCRIPT DEBUG][Content Script] Transcript panel element: " + transcriptPanel.tagName + " with class: " + (transcriptPanel.className || "none")
              );
              const segments = transcriptPanel.querySelectorAll(
                "ytd-transcript-segment-renderer"
              ) || transcriptPanel.querySelectorAll(".segment");
              console.log(
                "[TRANSCRIPT DEBUG][Content Script] Segments found: " + (segments ? segments.length : 0)
              );
              if (segments && segments.length > 0) {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] Processing " + segments.length + " transcript segments"
                );
                let transcript = "";
                Array.from(segments).forEach((segment) => {
                  const timestampElem = segment.querySelector(
                    ".segment-timestamp"
                  ) || segment.querySelector(
                    '[class*="timestamp"]'
                  );
                  const textElem = segment.querySelector(
                    ".segment-text"
                  ) || segment.querySelector(
                    '[class*="text"]'
                  );
                  if (timestampElem && textElem) {
                    const timestamp = timestampElem.textContent?.trim() || "";
                    const text = textElem.textContent?.trim() || "";
                    if (timestamp && text) {
                      const formattedTimestamp = `[${timestamp}]`;
                      transcript += `${formattedTimestamp} ${text}
`;
                    }
                  }
                });
                if (transcript.trim()) {
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Successfully extracted transcript with " + transcript.split("\n").length + " lines"
                  );
                  return { transcript: transcript.trim() };
                } else {
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Extracted empty transcript"
                  );
                }
              } else {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] No transcript segments found in panel"
                );
              }
            } else {
              console.log(
                "[TRANSCRIPT DEBUG][Content Script] No transcript panel found"
              );
            }
            console.log(
              "[TRANSCRIPT DEBUG][Content Script] Looking for transcript data in script tags"
            );
            const scriptTags = document.querySelectorAll("script");
            console.log(
              "[TRANSCRIPT DEBUG][Content Script] Found " + scriptTags.length + " script tags"
            );
            let found = false;
            for (let i = 0; i < scriptTags.length; i++) {
              const script = scriptTags[i];
              const content = script.textContent || "";
              if (content.includes('"transcriptRenderer"') || content.includes('"captionTracks"')) {
                found = true;
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] Found transcript data in script tag #" + i
                );
                try {
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Attempting to extract transcript from visible elements"
                  );
                  const transcriptItems = document.querySelectorAll(
                    "yt-formatted-string.segment-text"
                  );
                  const timestampItems = document.querySelectorAll(
                    "span.segment-timestamp"
                  );
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Found " + transcriptItems.length + " text segments and " + timestampItems.length + " timestamps"
                  );
                  if (transcriptItems.length > 0 && timestampItems.length > 0 && transcriptItems.length === timestampItems.length) {
                    console.log(
                      "[TRANSCRIPT DEBUG][Content Script] Processing visible transcript elements"
                    );
                    let transcript = "";
                    for (let i2 = 0; i2 < transcriptItems.length; i2++) {
                      const text = transcriptItems[i2].textContent?.trim() || "";
                      const timestamp = timestampItems[i2].textContent?.trim() || "";
                      if (text && timestamp) {
                        const formattedTimestamp = `[${timestamp}]`;
                        transcript += `${formattedTimestamp} ${text}
`;
                      }
                    }
                    if (transcript.trim()) {
                      console.log(
                        "[TRANSCRIPT DEBUG][Content Script] Successfully extracted transcript from visible elements"
                      );
                      return {
                        transcript: transcript.trim()
                      };
                    }
                  }
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Failed to extract transcript from visible elements"
                  );
                } catch (extractError) {
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Error extracting from visible elements: " + (extractError instanceof Error ? extractError.message : String(extractError))
                  );
                }
                try {
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Trying alternative transcript extraction method"
                  );
                  const transcriptContainer = document.querySelector(
                    "ytd-transcript-search-panel-renderer"
                  ) || document.querySelector(
                    "ytd-transcript-renderer"
                  );
                  if (transcriptContainer) {
                    console.log(
                      "[TRANSCRIPT DEBUG][Content Script] Found transcript container"
                    );
                    const segmentRows = transcriptContainer.querySelectorAll(
                      "ytd-transcript-segment-renderer, ytd-transcript-segment-list-renderer div.segment"
                    );
                    console.log(
                      "[TRANSCRIPT DEBUG][Content Script] Found " + segmentRows.length + " segment rows"
                    );
                    if (segmentRows.length > 0) {
                      let transcript = "";
                      segmentRows.forEach((row) => {
                        const timestamp = row.querySelector(
                          '[class*="timestamp"]'
                        )?.textContent?.trim() || row.querySelector(
                          "div.segment-timestamp"
                        )?.textContent?.trim() || "";
                        const text = row.querySelector(
                          '[class*="segment-text"]'
                        )?.textContent?.trim() || row.querySelector(
                          "div.segment-text"
                        )?.textContent?.trim() || row.querySelector(
                          "yt-formatted-string"
                        )?.textContent?.trim() || "";
                        if (timestamp && text) {
                          const formattedTimestamp = `[${timestamp}]`;
                          transcript += `${formattedTimestamp} ${text}
`;
                        }
                      });
                      if (transcript.trim()) {
                        console.log(
                          "[TRANSCRIPT DEBUG][Content Script] Successfully extracted transcript with alternative method"
                        );
                        return {
                          transcript: transcript.trim()
                        };
                      }
                    }
                  }
                } catch (altError) {
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Error with alternative extraction: " + (altError instanceof Error ? altError.message : String(altError))
                  );
                }
                break;
              }
            }
            if (found) {
              console.log(
                "[TRANSCRIPT DEBUG][Content Script] Found transcript data in page, but all extraction methods failed"
              );
              try {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] Attempting last-resort extraction from any visible transcript text"
                );
                const visibleTranscriptPanel = document.querySelector(
                  ".ytd-transcript-renderer"
                ) || document.querySelector(
                  '[id*="transcript"]'
                ) || document.querySelector(
                  '[class*="transcript"]'
                );
                if (visibleTranscriptPanel) {
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Found visible transcript panel"
                  );
                  const fullText = visibleTranscriptPanel.textContent || "";
                  if (fullText.trim().length > 100) {
                    console.log(
                      "[TRANSCRIPT DEBUG][Content Script] Extracted text content of length: " + fullText.length
                    );
                    const lines = fullText.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
                    if (lines.length > 0) {
                      let transcript = "";
                      let currentTimestamp = "";
                      for (const line of lines) {
                        if (/^\d+:\d+$/.test(
                          line.trim()
                        )) {
                          currentTimestamp = line.trim();
                        } else if (currentTimestamp && line.length > 3) {
                          transcript += `[${currentTimestamp}] ${line}
`;
                          currentTimestamp = "";
                        }
                      }
                      if (transcript.trim()) {
                        console.log(
                          "[TRANSCRIPT DEBUG][Content Script] Successfully created transcript from visible text"
                        );
                        return {
                          transcript: transcript.trim()
                        };
                      }
                    }
                  }
                }
              } catch (visibleTextError) {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] Error extracting visible text: " + (visibleTextError instanceof Error ? visibleTextError.message : String(visibleTextError))
                );
              }
              console.log(
                "[TRANSCRIPT DEBUG][Content Script] Applying raw transcript extraction"
              );
              const allPossibleTranscriptElements = document.querySelectorAll(
                '[class*="transcript"] yt-formatted-string, [id*="transcript"] yt-formatted-string, ytd-transcript-segment-renderer, .ytd-transcript-renderer yt-formatted-string, .segment-text, [class*="segment-text"]'
              );
              if (allPossibleTranscriptElements && allPossibleTranscriptElements.length > 0) {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] Found " + allPossibleTranscriptElements.length + " possible transcript elements"
                );
                let rawTranscript = [];
                allPossibleTranscriptElements.forEach((el) => {
                  const text = el.textContent?.trim();
                  if (text && text.length > 0) {
                    rawTranscript.push(text);
                  }
                });
                if (rawTranscript.length > 0) {
                  const uniqueLines = [
                    ...new Set(rawTranscript)
                  ];
                  const formattedTranscript = uniqueLines.join("\n");
                  console.log(
                    "[TRANSCRIPT DEBUG][Content Script] Successfully extracted raw transcript with " + uniqueLines.length + " lines"
                  );
                  return {
                    transcript: formattedTranscript,
                    note: "Raw extraction without timestamps"
                  };
                }
              }
              try {
                const anyTranscriptContent = document.querySelector(
                  '[class*="transcript-container"]'
                );
                if (anyTranscriptContent) {
                  const rawText = anyTranscriptContent.textContent?.trim();
                  if (rawText && rawText.length > 50) {
                    return {
                      transcript: "TRANSCRIPT CONTENT:\n\n" + rawText,
                      note: "Last resort extraction"
                    };
                  }
                }
              } catch (e) {
                console.log(
                  "[TRANSCRIPT DEBUG][Content Script] Last resort extraction failed"
                );
              }
              return {
                error: "Found transcript data in page, but all extraction methods failed"
              };
            }
            console.log(
              "[TRANSCRIPT DEBUG][Content Script] Could not find transcript on YouTube page"
            );
            return {
              error: "Could not find transcript on YouTube page"
            };
          } catch (e) {
            console.log(
              "[TRANSCRIPT DEBUG][Content Script] Error occurred during extraction: " + (e instanceof Error ? e.message : String(e))
            );
            return {
              error: `Error extracting transcript: ${e instanceof Error ? e.message : String(e)}`
            };
          }
        }
      });
      console.log(
        "[TRANSCRIPT DEBUG] Content script execution completed"
      );
      if (!results || results.length === 0 || !results[0].result) {
        console.log(
          "[TRANSCRIPT DEBUG] Script execution failed or returned no result"
        );
        throw new Error(
          "Script execution failed or returned no result"
        );
      }
      const transcriptResult = results[0].result;
      console.log(
        "[TRANSCRIPT DEBUG] Script execution returned result:",
        transcriptResult
      );
      if (transcriptResult.error) {
        console.log(
          "[TRANSCRIPT DEBUG] Transcript extraction failed with error: " + transcriptResult.error
        );
        throw new Error(
          `Transcript extraction failed: ${transcriptResult.error}`
        );
      }
      if (!transcriptResult.transcript || transcriptResult.transcript.trim() === "") {
        console.log("[TRANSCRIPT DEBUG] Extracted transcript is empty");
        throw new Error("Extracted transcript is empty");
      }
      console.log(
        "[TRANSCRIPT DEBUG] Successfully extracted transcript with " + transcriptResult.transcript.split("\n").length + " lines"
      );
      _YouTubeService.infoLog(
        `Successfully extracted transcript from YouTube page, length: ${transcriptResult.transcript.length} chars`
      );
      return transcriptResult.transcript;
    } catch (error) {
      console.log(
        "[TRANSCRIPT DEBUG] Error during browser transcript extraction:",
        error
      );
      _YouTubeService.errorLog(
        "Error during browser transcript extraction:",
        error
      );
      const err = error;
      throw new Error(
        `Browser-based transcript extraction failed: ${err.message}`
      );
    }
  }
};
// YouTube API key - loaded from environment or chrome.storage
__publicField(_YouTubeService, "API_KEY", "AIzaSyDqunJoC1b5Xx7PfJQ-eItSr0MzgOVIUsg");
// Debug flag to enable verbose logging
__publicField(_YouTubeService, "DEBUG", true);
var YouTubeService = _YouTubeService;

// background.ts
self.addEventListener("error", (event) => {
  console.error("[ServiceWorker] Uncaught error:", event.error);
});
self.addEventListener("unhandledrejection", (event) => {
  console.error("[ServiceWorker] Unhandled promise rejection:", event.reason);
});
var youtubeService = new YouTubeService();
async function injectNotificationSystem(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["notification.css"]
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["notification.js"]
  });
}
async function showNotification(tabId, message) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (msg) => {
      const showNotification2 = window.showNotification;
      if (showNotification2) {
        showNotification2(msg);
      }
    },
    args: [message]
  });
}
console.log("[Background] Mew Web Clipper extension background initialized.");
chrome.runtime.onInstalled.addListener(async () => {
  console.log(
    "[Background] onInstalled event fired. Creating context menu items."
  );
  chrome.contextMenus.create({
    id: "clearStorage",
    title: "Clear Mew Storage (Debug)",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "saveSelection",
    title: "Save Selection to Mew",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "savePage",
    title: "Save Page to Mew",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "setYouTubeApiKey",
    title: "Set YouTube API Key",
    contexts: ["page"]
  });
  const { userNodeId, userRootUrl } = await chrome.storage.local.get([
    "userNodeId",
    "userRootUrl"
  ]);
  if (!userNodeId || !userRootUrl || !userRootUrl.includes("mew-edge.ideaflow.app")) {
    console.log(
      "[Background] Missing or invalid user configuration. Opening setup window."
    );
    await chrome.storage.local.remove(["userNodeId", "userRootUrl"]);
    chrome.windows.create({
      url: "setup.html",
      type: "normal",
      width: 600,
      height: 400
    });
  } else {
    console.log("[Background] User configuration verified:", {
      userNodeId,
      userRootUrl
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
    const { userNodeId, userRootUrl } = await chrome.storage.local.get([
      "userNodeId",
      "userRootUrl"
    ]);
    if (!userNodeId || !userRootUrl || !userRootUrl.includes("mew-edge.ideaflow.app")) {
      throw new Error("Please complete the Mew Web Clipper setup first");
    }
    if (info.menuItemId === "clearStorage") {
      await chrome.storage.local.clear();
      console.log("[Background] Cleared local storage");
      return;
    }
    if (info.menuItemId === "setYouTubeApiKey") {
      if (tab.id) {
        await injectNotificationSystem(tab.id);
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return prompt("Enter your YouTube Data API key:");
          }
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
    if (YouTubeService.isYouTubeVideo(tab.url)) {
      try {
        const videoId = YouTubeService.extractVideoId(tab.url);
        if (!videoId) {
          throw new Error("Failed to extract video ID");
        }
        const existingTranscript = await mewApi.findNodeByText({
          parentNodeId: articleNodeId,
          nodeText: "Transcript"
        });
        if (!existingTranscript) {
          console.log("[Background] Fetching YouTube transcript");
          try {
            let transcript = await youtubeService.getTranscript(
              videoId
            );
            if (transcript.startsWith("CAPTION_URL:")) {
              console.log(
                "[Background] Received caption URL from page scraping"
              );
              const captionUrl = transcript.substring(
                "CAPTION_URL:".length
              );
              try {
                const response = await fetch(captionUrl);
                if (response.ok) {
                  const captionText = await response.text();
                  if (captionText.includes("<text ")) {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(
                      captionText,
                      "text/xml"
                    );
                    const textElements = xmlDoc.getElementsByTagName("text");
                    let parsedTranscript = "";
                    for (let i = 0; i < textElements.length; i++) {
                      const element = textElements[i];
                      const text = element.textContent || "";
                      const start = element.getAttribute("start");
                      if (text.trim() && start) {
                        const seconds = parseFloat(start);
                        const minutes = Math.floor(
                          seconds / 60
                        );
                        const remainingSeconds = Math.floor(seconds % 60);
                        const timestamp = `[${minutes.toString().padStart(
                          2,
                          "0"
                        )}:${remainingSeconds.toString().padStart(2, "0")}]`;
                        parsedTranscript += `${timestamp} ${text.trim()}
`;
                      }
                    }
                    if (parsedTranscript.trim()) {
                      transcript = parsedTranscript.trim();
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
            if (transcript && transcript.trim()) {
              const transcriptNodeId = await addClip(
                articleNodeId,
                "Transcript"
              );
              console.log(
                "[Background] Created Transcript node:",
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
            const errorMessage = transcriptError instanceof Error ? transcriptError.message : String(transcriptError);
            console.error(
              "[Background] Transcript error details:",
              errorMessage
            );
            try {
              const transcriptNodeId = await addClip(
                articleNodeId,
                "Transcript (Error Details)"
              );
              await addClip(
                transcriptNodeId,
                `Transcript extraction failed with error: ${errorMessage}

This is a debug node to help diagnose the issue.`
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
        currentWindow: true
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
      const { userNodeId, userRootUrl } = await chrome.storage.local.get([
        "userNodeId",
        "userRootUrl"
      ]);
      if (!userNodeId || !userRootUrl || !userRootUrl.includes("mew-edge.ideaflow.app")) {
        throw new Error(
          "Please complete the Mew Web Clipper setup first"
        );
      }
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
      if (YouTubeService.isYouTubeVideo(tab.url)) {
        try {
          const videoId = YouTubeService.extractVideoId(tab.url);
          if (!videoId) {
            throw new Error("Failed to extract video ID");
          }
          console.log(
            "[TRANSCRIPT DEBUG] Checking if Transcript node already exists under article node:",
            articleNodeId
          );
          const existingTranscript = await mewApi.findNodeByText({
            parentNodeId: articleNodeId,
            nodeText: "Transcript"
          });
          console.log(
            "[TRANSCRIPT DEBUG] Existing transcript node check result:",
            existingTranscript
          );
          if (!existingTranscript) {
            console.log("[Background] Fetching YouTube transcript");
            console.log(
              "[TRANSCRIPT DEBUG] No existing transcript node found, will attempt to create one"
            );
            try {
              let transcript = await youtubeService.getTranscript(
                videoId
              );
              if (transcript.startsWith("CAPTION_URL:")) {
                console.log(
                  "[Background] Received caption URL from page scraping"
                );
                const captionUrl = transcript.substring(
                  "CAPTION_URL:".length
                );
                try {
                  const response = await fetch(captionUrl);
                  if (response.ok) {
                    const captionText = await response.text();
                    if (captionText.includes("<text ")) {
                      const parser = new DOMParser();
                      const xmlDoc = parser.parseFromString(
                        captionText,
                        "text/xml"
                      );
                      const textElements = xmlDoc.getElementsByTagName(
                        "text"
                      );
                      let parsedTranscript = "";
                      for (let i = 0; i < textElements.length; i++) {
                        const element = textElements[i];
                        const text = element.textContent || "";
                        const start = element.getAttribute(
                          "start"
                        );
                        if (text.trim() && start) {
                          const seconds = parseFloat(start);
                          const minutes = Math.floor(
                            seconds / 60
                          );
                          const remainingSeconds = Math.floor(
                            seconds % 60
                          );
                          const timestamp = `[${minutes.toString().padStart(
                            2,
                            "0"
                          )}:${remainingSeconds.toString().padStart(2, "0")}]`;
                          parsedTranscript += `${timestamp} ${text.trim()}
`;
                        }
                      }
                      if (parsedTranscript.trim()) {
                        transcript = parsedTranscript.trim();
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
              const errorMessage = transcriptError instanceof Error ? transcriptError.message : String(transcriptError);
              console.error(
                "[Background] Transcript error details:",
                errorMessage
              );
              try {
                const transcriptNodeId = await addClip(
                  articleNodeId,
                  "Transcript (Error Details)"
                );
                await addClip(
                  transcriptNodeId,
                  `Transcript extraction failed with error: ${errorMessage}

This is a debug node to help diagnose the issue.`
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
        currentWindow: true
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
export {
  injectNotificationSystem,
  showNotification
};
//# sourceMappingURL=background.bundle.js.map
