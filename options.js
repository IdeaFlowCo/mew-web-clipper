document.addEventListener("DOMContentLoaded", async function () {
    const saveBtn = document.getElementById("saveBtn");
    const saveYtBtn = document.getElementById("saveYtBtn");
    const resetBtn = document.getElementById("resetBtn");
    const openMewBtn = document.getElementById("openMewBtn");
    const userNodeUrlInput = document.getElementById("userNodeUrl");
    const youtubeApiKeyInput = document.getElementById("youtubeApiKey");
    const currentSettings = document.getElementById("currentSettings");
    const currentSettingsContent = document.getElementById("currentSettingsContent");
    const statusMessage = document.getElementById("statusMessage");
    const userIdInfo = document.getElementById("userIdInfo");
    const currentUserId = document.getElementById("currentUserId");
    const copyUserIdBtn = document.getElementById("copyUserIdBtn");

    // Load and display current settings
    loadCurrentSettings();

    // Event Listeners
    saveBtn.addEventListener("click", saveUserConfiguration);
    saveYtBtn.addEventListener("click", saveYouTubeApiKey);
    resetBtn.addEventListener("click", resetAllSettings);
    openMewBtn.addEventListener("click", openMewWindow);
    copyUserIdBtn.addEventListener("click", copyUserIdToClipboard);
    
    // Listen for clipboard events to auto-capture the Mew URL
    document.addEventListener("paste", handlePaste);
    
    // Function to open Mew in a new window
    function openMewWindow() {
        window.open("https://mew-edge.ideaflow.app", "_blank", "width=1024,height=768");
        showStatus("Mew opened in a new window. Copy your user node URL and paste it here.", "success");
    }

    // Functions
    async function loadCurrentSettings() {
        try {
            const { userNodeId, userRootUrl, youtubeApiKey } = await chrome.storage.local.get([
                "userNodeId",
                "userRootUrl",
                "youtubeApiKey"
            ]);

            let content = "";
            let hasSettings = false;

            if (userNodeId && userRootUrl) {
                content += `<p><strong>Mew User Configuration:</strong> Connected</p>`;
                userNodeUrlInput.value = userRootUrl;
                hasSettings = true;
                
                // Display the user ID
                currentUserId.textContent = userNodeId;
                userIdInfo.classList.remove("hidden");
            } else {
                content += `<p><strong>Mew User Configuration:</strong> Not configured</p>`;
                userIdInfo.classList.add("hidden");
            }

            if (youtubeApiKey) {
                content += `<p><strong>YouTube API Key:</strong> Configured</p>`;
                youtubeApiKeyInput.value = youtubeApiKey;
                hasSettings = true;
            } else {
                content += `<p><strong>YouTube API Key:</strong> Not configured</p>`;
            }

            if (hasSettings) {
                currentSettingsContent.innerHTML = content;
                currentSettings.classList.remove("hidden");
            }
        } catch (error) {
            console.error("Error loading settings:", error);
        }
    }

    async function saveUserConfiguration() {
        const inputUrl = userNodeUrlInput.value.trim();
        if (!inputUrl) {
            showStatus("Please enter a valid URL", "error");
            return;
        }

        try {
            // Validate that this is a Mew URL
            const urlObj = new URL(inputUrl);
            if (!urlObj.hostname.includes("mew-edge.ideaflow.app")) {
                showStatus("Please enter a valid Mew URL (must be from mew-edge.ideaflow.app)", "error");
                return;
            }

            const segments = urlObj.pathname.split("/").filter((s) => s);
            // Validate URL format
            if (!segments.includes("global-root-to-users")) {
                showStatus("Invalid Mew URL format: Missing global-root-to-users", "error");
                return;
            }

            // Find the user-root-id segment
            const userRootIdSegment = segments.find((s) =>
                s.startsWith("user-root-id-")
            );
            if (!userRootIdSegment) {
                showStatus("Invalid Mew URL format: Missing user-root-id", "error");
                return;
            }

            let userNodeId = userRootIdSegment;
            // Save both userNodeId and userRootUrl using the input URL
            await chrome.storage.local.set({
                userNodeId,
                userRootUrl: inputUrl,
            });
            
            showStatus("Mew configuration saved successfully!", "success");
            loadCurrentSettings();
        } catch (error) {
            console.error("Error saving user configuration:", error);
            showStatus("Invalid URL format", "error");
        }
    }

    async function saveYouTubeApiKey() {
        const apiKey = youtubeApiKeyInput.value.trim();
        if (!apiKey) {
            showStatus("Please enter a valid YouTube API key", "error");
            return;
        }

        try {
            await chrome.storage.local.set({ youtubeApiKey: apiKey });
            showStatus("YouTube API key saved successfully!", "success");
            loadCurrentSettings();
        } catch (error) {
            console.error("Error saving YouTube API key:", error);
            showStatus("Failed to save YouTube API key", "error");
        }
    }

    async function resetAllSettings() {
        if (confirm("Are you sure you want to reset all settings? This action cannot be undone.")) {
            try {
                await chrome.storage.local.clear();
                userNodeUrlInput.value = "";
                youtubeApiKeyInput.value = "";
                showStatus("All settings have been reset", "success");
                currentSettings.classList.add("hidden");
            } catch (error) {
                console.error("Error resetting settings:", error);
                showStatus("Failed to reset settings", "error");
            }
        }
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
        statusMessage.classList.remove("hidden");
        
        // Auto-hide the message after 5 seconds
        setTimeout(() => {
            statusMessage.classList.add("hidden");
        }, 5000);
    }
    
    // Handle paste events to detect Mew URLs
    function handlePaste(e) {
        // Don't process paste events if they're happening in an input
        if (e.target === userNodeUrlInput || e.target === youtubeApiKeyInput) {
            return;
        }
        
        // Get pasted content from clipboard event
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('Text');
        
        // Check if it looks like a Mew URL
        if (pastedData && 
            pastedData.includes('mew-edge.ideaflow.app') && 
            pastedData.includes('global-root-to-users') &&
            pastedData.includes('user-root-id-')
        ) {
            userNodeUrlInput.value = pastedData;
            showStatus("Mew URL detected! Click Save Configuration to apply it.", "success");
            
            // Focus the save button for easy clicking
            saveBtn.focus();
            e.preventDefault();
        }
    }
    
    // Function to copy the user ID to clipboard
    function copyUserIdToClipboard() {
        if (currentUserId.textContent) {
            navigator.clipboard.writeText(currentUserId.textContent)
                .then(() => {
                    showStatus("User ID copied to clipboard!", "success");
                })
                .catch(err => {
                    console.error('Error copying text: ', err);
                    showStatus("Failed to copy user ID", "error");
                });
        }
    }
});
