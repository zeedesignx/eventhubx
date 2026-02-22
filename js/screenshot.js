/* ────────────────────────────────────────────────────────────
 * screenshot.js — Screenshot capture with html2canvas
 * ──────────────────────────────────────────────────────────── */

/**
 * Captures a screenshot of the main content area (excluding sidebar)
 * and opens the annotation canvas.
 */
async function captureScreenshot() {
    try {
        // Show loading indicator
        const btn = event.target;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span>';
        btn.disabled = true;

        // Capture the main content area (excludes sidebar)
        const mainElement = document.querySelector('main');

        if (!mainElement) {
            throw new Error('Main content element not found');
        }

        // Use html2canvas to capture the viewport
        const canvas = await html2canvas(mainElement, {
            backgroundColor: '#0f172a',
            scale: 1,
            logging: false,
            useCORS: true,
            allowTaint: false,
            windowWidth: mainElement.scrollWidth,
            windowHeight: mainElement.scrollHeight
        });

        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');

        // Restore button
        btn.innerHTML = originalHTML;
        btn.disabled = false;

        // Open annotation canvas with the screenshot
        openAnnotationCanvas(dataUrl);

    } catch (err) {
        console.error('Screenshot capture failed:', err);

        // Restore button
        if (event && event.target) {
            event.target.innerHTML = '<span class="material-symbols-outlined">screenshot_monitor</span>';
            event.target.disabled = false;
        }

        // Show error toast
        if (typeof showToast === 'function') {
            showToast('Error', 'Screenshot capture failed. Please try again.');
        } else {
            alert('Screenshot capture failed. Please try again.');
        }
    }
}

/**
 * Called when annotation is finalized to attach screenshot to chat
 */
function attachScreenshotToChat(dataUrl) {
    // Store the screenshot data URL globally
    window.attachedScreenshot = dataUrl;

    // Show preview in chat panel
    const previewContainer = document.getElementById('claude-screenshot-preview');
    const previewImg = document.getElementById('claude-screenshot-img');

    if (previewContainer && previewImg) {
        previewImg.src = dataUrl;
        previewContainer.classList.remove('hidden');
    }

    // Focus chat input
    const input = document.getElementById('claude-input');
    if (input) {
        input.focus();
    }
}

/**
 * Remove attached screenshot
 */
function removeScreenshot() {
    window.attachedScreenshot = null;

    const previewContainer = document.getElementById('claude-screenshot-preview');
    if (previewContainer) {
        previewContainer.classList.add('hidden');
    }
}
