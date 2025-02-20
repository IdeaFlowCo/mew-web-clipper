import axios from "axios";
import {
    API_URL,
    CLIENT_ID,
    getCurrentUser,
    generateTransactionId,
    SyncUpdate,
} from "./config";

// Add detailed logging of each update item
export async function syncGraphChanges(updates: SyncUpdate[]) {
    // Add DEBUG level logging
    console.log("[MewService] Preparing sync payload with updates:", {
        count: updates.length,
        types: updates.map((u) => u.operation),
    });

    // Detailed logging for each update
    updates.forEach((update, index) => {
        console.log(`[MewService] Update ${index + 1}/${updates.length}:`, {
            operation: update.operation,
            ...(update.operation === "addNode" && {
                nodeId: update.node.id,
                nodeType: update.node.type,
            }),
            ...(update.operation === "addRelation" && {
                relationId: update.relation.id,
                fromNode: update.relation.fromId,
                toNode: update.relation.toId,
            }),
            ...(update.operation === "updateRelationList" && {
                relationId: update.relationId,
                position: update.newPosition,
            }),
        });
    });

    try {
        // Make sure we're sending the actual payload
        const response = await axios.post(`${API_URL}/sync`, {
            clientId: CLIENT_ID,
            userId: getCurrentUser().id,
            transactionId: generateTransactionId(),
            updates,
        });

        console.log("[MewService] Sync successful:", response.data);
        return response.data;
    } catch (error) {
        // Enhanced error logging
        console.error("[MewService] Sync failed with details:", {
            url: `${API_URL}/sync`,
            payload: { updates },
            status: error.response?.status,
            response: error.response?.data,
            validationErrors: error.response?.data?.errors,
        });
        throw new Error("Failed to sync changes with Mew API");
    }
}
