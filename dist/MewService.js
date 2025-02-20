import { Logger } from "./utils/logger.js";
export const AUTH_CONFIG = {
    baseUrl: "https://mew-edge.ideaflow.app/api",
    baseNodeUrl: "https://mew-edge.ideaflow.app/",
    auth0Domain: "ideaflow-mew-dev.us.auth0.com",
    auth0ClientId: "zbhouY8SmHtIIJSjt1gu8TR3FgMsgo3J",
    auth0ClientSecret: "x0SAiFCCMwfgNEzU29KFh3TR4sTWuQVDqrRwBWCe0KsbA7WEd-1Ypatb47LCQ_Xb",
    auth0Audience: "https://ideaflow-mew-dev.us.auth0.com/api/v2/",
};
const logger = new Logger("MewService");
export var NodeContentType;
(function (NodeContentType) {
    NodeContentType["Text"] = "text";
    NodeContentType["Replacement"] = "replacement";
    NodeContentType["Mention"] = "mention";
})(NodeContentType || (NodeContentType = {}));
export function createNodeContent(content) {
    if (Array.isArray(content)) {
        return content;
    }
    if (content.type === NodeContentType.Text) {
        return [{ type: "text", value: content.text, styles: 0 }];
    }
    else if (content.type === "text" && content.text) {
        return [{ type: "text", value: content.text, styles: 0 }];
    }
    else if (content.type === NodeContentType.Mention) {
        return [
            {
                type: "text",
                value: content.mentionData.preMentionText,
                styles: 0,
            },
            {
                type: "mention",
                value: content.mentionData.mentionNodeId,
                mentionTrigger: "@",
            },
            {
                type: "text",
                value: content.mentionData.postMentionText,
                styles: 0,
            },
        ];
    }
    else if (content.type === NodeContentType.Replacement) {
        return [{ type: "text", value: "replacement", styles: 0 }];
    }
    return [{ type: "text", value: "", styles: 0 }];
}
export class MewAPI {
    baseUrl;
    baseNodeUrl;
    token;
    currentUserId;
    constructor() {
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
            const response = await fetch(`https://${AUTH_CONFIG.auth0Domain}/oauth/token`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    client_id: AUTH_CONFIG.auth0ClientId,
                    client_secret: AUTH_CONFIG.auth0ClientSecret,
                    audience: AUTH_CONFIG.auth0Audience,
                    grant_type: "client_credentials",
                }),
            });
            if (!response.ok) {
                throw new Error(`Auth failed: ${response.statusText}`);
            }
            const data = await response.json();
            this.token = data.access_token;
        }
        catch (error) {
            if (error instanceof Error) {
                logger.error("Failed to fetch access token:", error);
            }
            else {
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
                canonicalRelationId: null,
                isChecked: isChecked ?? null,
            },
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
                    canonicalRelationId: null,
                },
                fromPos: { int: timestamp, frac: "a0" },
                toPos: { int: timestamp, frac: "a0" },
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
                relatedNodeId: newNodeId,
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
                        { type: "text", value: relationLabel, styles: 0 },
                    ],
                    isPublic: true,
                    isNewRelatedObjectsPublic: false,
                    canonicalRelationId: null,
                    isChecked: null,
                },
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
                    canonicalRelationId: null,
                },
                fromPos: { int: timestamp, frac: "a0" },
                toPos: { int: timestamp, frac: "a0" },
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
                relatedNodeId: relationLabelNodeId,
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
                    canonicalRelationId: null,
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
                    canonicalRelationId: newRelationTypeId,
                },
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
                    canonicalRelationId: null,
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
                    canonicalRelationId: content.replacementNodeData
                        .referenceCanonicalRelationId,
                },
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
                relatedNodeId: content.replacementNodeData.referenceNodeId,
            });
        }
        const token = await this.getAccessToken();
        const payload = {
            clientId: AUTH_CONFIG.auth0ClientId,
            userId: usedAuthorId,
            transactionId: transactionId,
            updates: updates,
        };
        const txResponse = await fetch(`${this.baseUrl}/sync`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
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
            referenceNodeId: content?.type === "Replacement" && content.replacementNodeData
                ? content.replacementNodeData.referenceNodeId
                : "",
            referenceCanonicalRelationId: content?.type === "Replacement" && content.replacementNodeData
                ? content.replacementNodeData.referenceCanonicalRelationId
                : "",
            isChecked: isChecked ?? undefined,
        };
    }
    async syncData() {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.baseUrl}/sync`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
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
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ objectIds }),
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch layer data: ${response.statusText}`);
        }
        const layerData = await response.json();
        return layerData;
    }
    async findNodeByText({ parentNodeId, nodeText, }) {
        const { parentNode, childNodes } = await this.getChildNodes({
            parentNodeId,
        });
        console.log("findNodeByText: searching for exact text match:", nodeText);
        console.log("findNodeByText: child nodes content:", childNodes.map((node) => ({
            id: node.id,
            content: node.content,
            textValue: node.content?.[0]?.value,
        })));
        const node = childNodes.find((node) => node.content &&
            node.content.length > 0 &&
            node.content[0].value === nodeText);
        console.log("findNodeByText: found node:", {
            searchedFor: nodeText,
            foundNodeContent: node?.content?.[0]?.value,
            node,
        });
        return node;
    }
    async getChildNodes({ parentNodeId, }) {
        const layerData = await this.getLayerData([parentNodeId]);
        const parentNode = layerData.data.nodesById[parentNodeId];
        const childRelations = Object.values(layerData.data.relationsById).filter((relation) => relation !== null &&
            typeof relation === "object" &&
            "fromId" in relation &&
            "toId" in relation &&
            "relationTypeId" in relation &&
            relation.fromId === parentNodeId &&
            relation.relationTypeId === "child");
        const childNodes = childRelations.map((relation) => {
            const nodeData = layerData.data.nodesById[relation.toId];
            return nodeData;
        });
        return {
            parentNode,
            childNodes,
        };
    }
    getNodeUrl(nodeId) {
        return `${this.baseUrl}/g/all/global-root-to-users/all/users-to-user-relation-id/${nodeId}`;
    }
}
export const parseNodeIdFromUrl = (url) => {
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
