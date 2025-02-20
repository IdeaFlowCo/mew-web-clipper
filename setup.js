document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("saveBtn").addEventListener("click", async () => {
        const inputUrl = document.getElementById("userNodeUrl").value.trim();
        if (inputUrl) {
            try {
                // Validate that this is a Mew URL
                const urlObj = new URL(inputUrl);
                if (!urlObj.hostname.includes("mew-edge.ideaflow.app")) {
                    alert(
                        "Please enter a valid Mew URL (must be from mew-edge.ideaflow.app)"
                    );
                    return;
                }

                const segments = urlObj.pathname.split("/").filter((s) => s);
                // Validate URL format
                if (!segments.includes("global-root-to-users")) {
                    alert(
                        "Invalid Mew URL format: Missing global-root-to-users"
                    );
                    return;
                }

                // Find the user-root-id segment
                const userRootIdSegment = segments.find((s) =>
                    s.startsWith("user-root-id-")
                );
                if (!userRootIdSegment) {
                    alert("Invalid Mew URL format: Missing user-root-id");
                    return;
                }

                let userNodeId = userRootIdSegment;
                // Save both userNodeId and userRootUrl using the input URL
                await chrome.storage.local.set({
                    userNodeId,
                    userRootUrl: inputUrl,
                });
                console.log(
                    "User Node ID and Root URL saved:",
                    userNodeId,
                    inputUrl
                );
                finalizeSetup();
            } catch (error) {
                alert("Invalid URL. Please enter a valid URL.");
            }
        } else {
            alert("Please enter a valid User Node URL.");
        }
    });
});

// After successful setup, close the setup window (do not override userRootUrl)
function finalizeSetup() {
    console.log("Setup complete. Closing setup window.");
    // Close the tab after saving
    if (chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
                chrome.tabs.remove(tabs[0].id);
            } else {
                window.close();
            }
        });
    } else {
        window.close();
    }
}
