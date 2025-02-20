export const API_URL = "https://mew-edge.ideaflow.app/api";
export const CLIENT_ID = "zbhouY8SmHtIIJSjt1gu8TR3FgMsgo3J";
export function getCurrentUser() {
    return {
        id: "auth0|6793c6489ed96468672bae93",
    };
}
export function generateTransactionId() {
    return crypto.randomUUID();
}
