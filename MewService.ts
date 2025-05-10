import { Logger } from "./utils/logger.js";

export const AUTH_CONFIG = {
    baseUrl: "https://mew-edge.ideaflow.app/api",
    baseNodeUrl: "https://mew-edge.ideaflow.app/",
    auth0Domain: "ideaflow-mew-dev.us.auth0.com",
    auth0ClientId: "zbhouY8SmHtIIJSjt1gu8TR3FgMsgo3J",
    auth0ClientSecret:
        "x0SAiFCCMwfgNEzU29KFh3TR4sTWuQVDqrRwBWCe0KsbA7WEd-1Ypatb47LCQ_Xb",
    auth0Audience: "https://ideaflow-mew-dev.us.auth0.com/api/v2/",
    // userId: "auth0|6793c6489ed96468672bae93",
    // userId: "auth0|67b00414a18956f5273397da", // cody+mewagent@ideaflow.io
};

const logger = new Logger("MewService");

/* MewService.ts - Tailored for our conversation integration project */

export interface ConversationNode {
    id: string;
    parentNodeId: string;
    text: string;
    createdAt: string;
}

export enum NodeContentType {
    Text = "text",
    Replacement = "replacement",
    Mention = "mention",
}

export interface ReplacementNodeData {
    referenceNodeId: string;
    referenceCanonicalRelationId: string;
}

export interface MentionData {
    preMentionText: string;
    postMentionText: string;
    mentionNodeId: string;
}

export type NodeContent =
    | { type: NodeContentType.Text; text: string }
    | {
          type: NodeContentType.Replacement;
          replacementNodeData: ReplacementNodeData;
      }
    | { type: NodeContentType.Mention; mentionData: MentionData };

export function createNodeContent(content: any) {
    // If content is already in the correct format, return it
    if (Array.isArray(content)) {
        return content;
    }

    // Handle our NodeContent type
    if (content.type === NodeContentType.Text) {
        return [{ type: "text", value: content.text, styles: 0 }];
    } else if (content.type === "text" && content.text) {
        // Handle the format coming from mewClipper
        return [{ type: "text", value: content.text, styles: 0 }];
    } else if (content.type === NodeContentType.Mention) {
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
    } else if (content.type === NodeContentType.Replacement) {
        return [{ type: "text", value: "replacement", styles: 0 }];
    }

    // Default case
    return [{ type: "text", value: "", styles: 0 }];
}

export class MewAPI {
    private baseUrl: string;
    private baseNodeUrl: string;
    private token: string;
    private currentUserId: string;

    constructor() {
        // Use the base URL from our AUTH_CONFIG
        this.baseUrl = AUTH_CONFIG.baseUrl;
        this.baseNodeUrl = AUTH_CONFIG.baseNodeUrl;
        this.token = "";
        this.currentUserId = ""; // Will be set from user's root node URL
    }

    public setCurrentUserId(userId: string): void {
        this.currentUserId = userId;
    }

    public getCurrentUser(): { id: string } {
        return { id: this.currentUserId };
    }

    private uuid(): string {
        return crypto.randomUUID();
    }

    async getAccessToken(): Promise<string> {
        // Retrieve an access token using Auth0 credentials.
        try {
            const response = await fetch(
                `https://${AUTH_CONFIG.auth0Domain}/oauth/token`,
                {
                    method: "POST",
                    mode: "cors",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        client_id: AUTH_CONFIG.auth0ClientId,
                        client_secret: AUTH_CONFIG.auth0ClientSecret,
                        audience: AUTH_CONFIG.auth0Audience,
                        grant_type: "client_credentials",
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`Auth failed: ${response.statusText}`);
            }

            const data = await response.json();
            this.token = data.access_token;
        } catch (error: unknown) {
            if (error instanceof Error) {
                logger.error("Failed to fetch access token:", error);
            } else {
                logger.error("Failed to fetch access token: Unknown error");
            }
            // Fallback to a dummy token if necessary
            this.token = "dummy-access-token";
        }
        return this.token;
    }

    async addNode(input: {
        content: any;
        parentNodeId?: string;
        relationLabel?: string;
        isChecked?: boolean;
        authorId?: string;
    }): Promise<{
        newNodeId: string;
        newRelationLabelNodeId: string;
        parentChildRelationId: string;
        referenceNodeId: string;
        referenceCanonicalRelationId: string;
        isChecked?: boolean;
    }> {
        const { content, parentNodeId, relationLabel, isChecked, authorId } =
            input;
        const nodeContent = createNodeContent(content);
        const usedAuthorId = authorId ?? this.currentUserId;
        const newNodeId = this.uuid();
        const parentChildRelationId = this.uuid();
        const transactionId = this.uuid();
        const timestamp = Date.now();
        let relationLabelNodeId = "";

        const updates: any[] = [];

        // Step 1: Add the new node.
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
                canonicalRelationId: parentNodeId
                    ? parentChildRelationId
                    : null,
                isChecked: isChecked ?? null,
                accessMode: 0,
                attributes: {
                    isAiGenerated: false,
                    isUnconfirmed: false,
                },
            },
        });

        // Step 2: If a parent is provided, establish the child relation.
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
            // Single updateRelationList operation for the parent-child relation
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

        // Step 3: Optionally create a relation label node if a relationLabel is provided.
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
                    accessMode: 0,
                    attributes: {
                        isAiGenerated: false,
                        isUnconfirmed: false,
                    },
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
            // Update the original child relation to reference the new relation type
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

        // Step 4: If the content type is Replacement, update the parent-child relation accordingly.
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
                    canonicalRelationId:
                        content.replacementNodeData
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

        // Step 5: Execute one transaction with all updates.
        const token = await this.getAccessToken();
        const payload = {
            clientId: AUTH_CONFIG.auth0ClientId,
            userId: usedAuthorId,
            transactionId: transactionId,
            updates: updates,
        };

        let txResponse;
        try {
            txResponse = await fetch(`${this.baseUrl}/sync`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });
        } catch (error: unknown) {
            // Handle network errors, timeouts, etc.
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errMsg = `Network error when connecting to API: ${errorMessage}`;
            logger.error(errMsg);
            logger.error("Request payload was:", payload);
            
            return {
                newNodeId: this.uuid(),
                newRelationLabelNodeId: "",
                parentChildRelationId: parentChildRelationId,
                referenceNodeId: "",
                referenceCanonicalRelationId: "",
                isChecked: isChecked ?? undefined,
            };
        }

        if (!txResponse.ok) {
            const responseText = await txResponse.text();
            const errMsg = `Failed to add node: Status ${txResponse.status} ${txResponse.statusText}. Response: ${responseText}`;
            logger.error(errMsg);
            logger.error("Request payload was:", payload);
            
            return {
                newNodeId: this.uuid(),
                newRelationLabelNodeId: "",
                parentChildRelationId: parentChildRelationId,
                referenceNodeId: "",
                referenceCanonicalRelationId: "",
                isChecked: isChecked ?? undefined,
            };
        }

        if (txResponse.ok && isChecked) {
            // Optionally update the node's isChecked status.
            // await this.updateNode(newNodeId, { isChecked: true });
        }

        return {
            newNodeId,
            newRelationLabelNodeId: relationLabelNodeId,
            parentChildRelationId,
            referenceNodeId:
                content?.type === "Replacement" && content.replacementNodeData
                    ? content.replacementNodeData.referenceNodeId
                    : "",
            referenceCanonicalRelationId:
                content?.type === "Replacement" && content.replacementNodeData
                    ? content.replacementNodeData.referenceCanonicalRelationId
                    : "",
            isChecked: isChecked ?? undefined,
        };
    }

    async syncData(): Promise<any> {
        const token = await this.getAccessToken();
        try {
            const response = await fetch(`${this.baseUrl}/sync`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });
            
            if (!response.ok) {
                logger.error(`Failed to sync data: ${response.statusText}`);
                return { data: { usersById: {}, nodesById: {}, relationsById: {} } };
            }
            
            return response.json();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Network error when syncing data: ${errorMessage}`);
            return { data: { usersById: {}, nodesById: {}, relationsById: {} } };
        }
    }

    async getLayerData(objectIds: string[]): Promise<any> {
        const token = await this.getAccessToken();
        try {
            const response = await fetch(`${this.baseUrl}/layer`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ objectIds }),
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });
            
            if (!response.ok) {
                logger.error(`Failed to fetch layer data: ${response.statusText}`);
                return { data: { nodesById: {}, relationsById: {} } };
            }
            
            const layerData = await response.json();
            return layerData;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Network error when fetching layer data: ${errorMessage}`);
            return { data: { nodesById: {}, relationsById: {} } };
        }
    }

    /**
     * Finds a node with exact text match under a parent node
     * @returns The matching node or undefined
     */
    async findNodeByText({
        parentNodeId,
        nodeText,
    }: {
        parentNodeId: string;
        nodeText: string;
    }) {
        const { parentNode, childNodes } = await this.getChildNodes({
            parentNodeId,
        });
        console.log(
            "findNodeByText: searching for exact text match:",
            nodeText
        );
        console.log(
            "findNodeByText: child nodes content:",
            childNodes
                .filter((node) => node)
                .map((node) => ({
                    id: node.id,
                    content: node.content,
                    textValue: node.content?.[0]?.value,
                }))
        );

        const node = childNodes.find(
            (node) =>
                node &&
                node.content &&
                node.content.length > 0 &&
                node.content[0].value === nodeText
        );

        console.log("findNodeByText: found node:", {
            searchedFor: nodeText,
            foundNodeContent: node?.content?.[0]?.value,
            node,
        });

        return node;
    }

    async getChildNodes({
        parentNodeId,
    }: {
        parentNodeId: string;
    }): Promise<{ parentNode: GraphNode; childNodes: GraphNode[] }> {
        const layerData = await this.getLayerData([parentNodeId]);

        const parentNode = layerData.data.nodesById[parentNodeId];

        const childRelations = Object.values(
            layerData.data.relationsById
        ).filter(
            (relation): relation is Relation =>
                relation !== null &&
                typeof relation === "object" &&
                "fromId" in relation &&
                "toId" in relation &&
                "relationTypeId" in relation &&
                relation.fromId === parentNodeId &&
                relation.relationTypeId === "child"
        );

        const childNodes = childRelations.map((relation) => {
            const nodeData = layerData.data.nodesById[relation.toId];
            return nodeData;
        });

        return {
            parentNode,
            childNodes,
        };
    }

    getNodeUrl(nodeId: string): string {
        return `${this.baseUrl}/g/all/global-root-to-users/all/users-to-user-relation-id/${nodeId}`;
    }
}

export const parseNodeIdFromUrl = (url: string): string => {
    const regex =
        /^https?:\/\/mew-edge\.ideaflow\.app\/g\/all\/global-root-to-users\/all\/users-to-user-relation-id-[^\/]+\/user-root-id-[^\/]+$/;
    if (!regex.test(url)) {
        throw new Error("Invalid user node URL format");
    }
    const urlParts = url.split("/");
    const lastPart = urlParts[urlParts.length - 1];

    // First handle any raw %7C or %7c that might be in the string
    let decoded = lastPart.replace(/%7C/gi, "|");
    // Then do a full URL decode to handle any other encoded characters
    decoded = decodeURIComponent(decoded);
    // Finally ensure any remaining encoded pipes are handled
    decoded = decoded.replace(/%7C/gi, "|");

    return decoded;
};

export interface GraphNode {
    version: number;
    id: string;
    authorId: string;
    createdAt: string;
    updatedAt: string;
    content: ContentBlock[];
    isPublic: boolean;
    isNewRelatedObjectsPublic: boolean;
    relationId: string | null;
    canonicalRelationId: string | null;
    isChecked: boolean | null;
}

export interface ContentBlock {
    type: "text" | "mention"; // Could be expanded if there are other types
    value: string;
}

interface User {
    id: string;
    username: string;
    email: string;
}

export interface Relation {
    fromId: string;
    toId: string;
    relationTypeId: string;
}

interface SyncResponse {
    data: {
        usersById: {
            [key: string]: User;
        };
        nodesById: {
            [key: string]: GraphNode;
        };
        relationsById: {
            [key: string]: Relation;
        };
    };
}

interface TokenData {
    access_token: string;
    expires_in: number;
    token_type: string;
}
