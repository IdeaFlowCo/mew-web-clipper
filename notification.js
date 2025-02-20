// Export the function and also make it available on window
function showNotification(message) {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = "mew-notification";
    notification.textContent = message;

    // Add to page
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
        notification.classList.add("show");
    }, 100);

    // Remove after delay
    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 2000);
}

// Make it available globally
window.showNotification = showNotification;
