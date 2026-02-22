/* ────────────────────────────────────────────────────────────
 * claude-chat.js — Claude AI chat overlay widget with expand mode
 * ──────────────────────────────────────────────────────────── */

// Global state
let currentSessionId = null;
let chatMessages = [];
let isExpanded = false;
window.attachedScreenshot = null;

/**
 * Toggle chat widget visibility (show/hide floating widget)
 */
function toggleChatWidget() {
    const button = document.getElementById('claude-chat-button');
    const widget = document.getElementById('claude-chat-widget');

    if (!button || !widget) return;

    const isHidden = widget.classList.contains('hidden');

    if (isHidden) {
        // Show widget
        widget.classList.remove('hidden');
        button.classList.add('hidden');

        // Load latest session or create new
        if (!currentSessionId) {
            loadLatestSession();
        }

        // Focus input
        setTimeout(() => {
            const input = document.getElementById('claude-input');
            if (input) input.focus();
        }, 100);
    } else {
        // Hide widget
        widget.classList.add('hidden');
        button.classList.remove('hidden');
    }
}

/**
 * Expand chat widget to full sidebar
 */
function expandChatWidget() {
    const widget = document.getElementById('claude-chat-widget');
    const expanded = document.getElementById('claude-chat-expanded');
    const button = document.getElementById('claude-chat-button');

    if (!widget || !expanded) return;

    // Hide widget and button
    widget.classList.add('hidden');
    button.classList.add('hidden');

    // Show expanded mode
    expanded.classList.remove('hidden');
    expanded.classList.add('flex');

    isExpanded = true;

    // Sync messages to expanded view
    syncMessagesToExpanded();

    // Sync session dropdown
    syncSessionDropdown();

    // Focus input
    setTimeout(() => {
        const input = document.getElementById('claude-input-expanded');
        if (input) input.focus();
    }, 100);
}

/**
 * Collapse from sidebar back to widget
 */
function collapseChatWidget() {
    const widget = document.getElementById('claude-chat-widget');
    const expanded = document.getElementById('claude-chat-expanded');

    if (!widget || !expanded) return;

    // Hide expanded mode
    expanded.classList.remove('flex');
    expanded.classList.add('hidden');

    // Show widget
    widget.classList.remove('hidden');

    isExpanded = false;

    // Sync messages back to widget
    syncMessagesToWidget();
}

/**
 * Close chat completely (back to button)
 */
function closeChatCompletely() {
    const button = document.getElementById('claude-chat-button');
    const widget = document.getElementById('claude-chat-widget');
    const expanded = document.getElementById('claude-chat-expanded');

    if (widget) widget.classList.add('hidden');
    if (expanded) {
        expanded.classList.remove('flex');
        expanded.classList.add('hidden');
    }
    if (button) button.classList.remove('hidden');

    isExpanded = false;
}

/**
 * Open chat panel (called from sidebar button - goes straight to widget)
 */
function openChatPanel() {
    toggleChatWidget();
}

/**
 * Close chat panel (for compatibility)
 */
function closeChatPanel() {
    closeChatCompletely();
}

/**
 * Sync messages from widget to expanded view
 */
function syncMessagesToExpanded() {
    const widgetMessages = document.getElementById('claude-messages');
    const expandedMessages = document.getElementById('claude-messages-expanded');

    if (widgetMessages && expandedMessages) {
        expandedMessages.innerHTML = widgetMessages.innerHTML;
        // Scale up message styles for expanded view
        expandedMessages.querySelectorAll('.text-xs').forEach(el => {
            el.classList.remove('text-xs');
            el.classList.add('text-sm');
        });
        expandedMessages.querySelectorAll('.text-[10px]').forEach(el => {
            el.classList.remove('text-[10px]');
            el.classList.add('text-xs');
        });
        expandedMessages.querySelectorAll('.text-lg').forEach(el => {
            el.classList.remove('text-lg');
            el.classList.add('text-2xl');
        });
    }
}

/**
 * Sync messages from expanded to widget view
 */
function syncMessagesToWidget() {
    const widgetMessages = document.getElementById('claude-messages');
    const expandedMessages = document.getElementById('claude-messages-expanded');

    if (widgetMessages && expandedMessages) {
        widgetMessages.innerHTML = expandedMessages.innerHTML;
        // Scale down message styles for widget view
        widgetMessages.querySelectorAll('.text-sm').forEach(el => {
            el.classList.remove('text-sm');
            el.classList.add('text-xs');
        });
        widgetMessages.querySelectorAll('.text-xs').forEach(el => {
            if (!el.classList.contains('text-[10px]')) {
                el.classList.remove('text-xs');
                el.classList.add('text-[10px]');
            }
        });
        widgetMessages.querySelectorAll('.text-2xl').forEach(el => {
            el.classList.remove('text-2xl');
            el.classList.add('text-lg');
        });
    }
}

/**
 * Sync session dropdown between widget and expanded
 */
function syncSessionDropdown() {
    const widgetSelect = document.getElementById('claude-session-select');
    const expandedSelect = document.getElementById('claude-session-select-expanded');

    if (widgetSelect && expandedSelect) {
        expandedSelect.innerHTML = widgetSelect.innerHTML;
        expandedSelect.value = widgetSelect.value;
    }
}

/**
 * Load latest session or create new
 */
async function loadLatestSession() {
    try {
        const response = await fetch('/api/claude/sessions');
        const result = await response.json();

        if (result.status === 'success' && result.sessions && result.sessions.length > 0) {
            // Load most recent session
            const latestSession = result.sessions[0];
            await loadSession(latestSession.session_id);

            // Populate session dropdown
            populateSessionDropdown(result.sessions);
        } else {
            // Create new session
            await createNewSession();
        }
    } catch (err) {
        console.error('Failed to load sessions:', err);
        await createNewSession();
    }
}

/**
 * Populate session dropdown
 */
function populateSessionDropdown(sessions) {
    const select = document.getElementById('claude-session-select');
    if (!select) return;

    select.innerHTML = '<option value="new">+ New Chat</option>';

    sessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.session_id;
        option.textContent = session.title;
        if (session.session_id === currentSessionId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

/**
 * Switch to different session
 */
async function switchChatSession(sessionId) {
    if (sessionId === 'new') {
        await createNewSession();
    } else {
        await loadSession(sessionId);
    }
}

/**
 * Create new chat session
 */
async function createNewSession() {
    try {
        const response = await fetch('/api/claude/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (result.status === 'success') {
            currentSessionId = result.session.session_id;
            chatMessages = [];

            // Clear message list (keep welcome message)
            const messagesContainer = document.getElementById('claude-messages');
            if (messagesContainer) {
                // Keep only the welcome message
                const welcomeMsg = messagesContainer.querySelector('.flex.items-start.gap-3');
                messagesContainer.innerHTML = '';
                if (welcomeMsg) {
                    messagesContainer.appendChild(welcomeMsg.cloneNode(true));
                }
            }

            // Update dropdown
            await loadLatestSession();
        }
    } catch (err) {
        console.error('Failed to create session:', err);
        showToast('Error', 'Failed to create new chat session');
    }
}

/**
 * Load existing session
 */
async function loadSession(sessionId) {
    try {
        const response = await fetch(`/api/claude/sessions/${sessionId}`);
        const result = await response.json();

        if (result.status === 'success') {
            currentSessionId = sessionId;
            chatMessages = result.session.messages || [];

            // Render all messages
            renderMessages();
        }
    } catch (err) {
        console.error('Failed to load session:', err);
        showToast('Error', 'Failed to load chat session');
    }
}

/**
 * Render all messages in the chat
 */
function renderMessages() {
    const containerId = isExpanded ? 'claude-messages-expanded' : 'claude-messages';
    const messagesContainer = document.getElementById(containerId);
    if (!messagesContainer) return;

    // Keep welcome message, clear rest
    const welcomeMsg = messagesContainer.querySelector('.flex.items-start');
    messagesContainer.innerHTML = '';
    if (welcomeMsg) {
        messagesContainer.appendChild(welcomeMsg.cloneNode(true));
    }

    // Render all messages
    chatMessages.forEach(msg => {
        appendMessage(msg.role, msg.content, msg.screenshot, false);
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Append message to chat (works in both widget and expanded modes)
 */
function appendMessage(role, content, screenshot = null, animate = true) {
    const containerId = isExpanded ? 'claude-messages-expanded' : 'claude-messages';
    const messagesContainer = document.getElementById(containerId);
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    const gapClass = isExpanded ? 'gap-3' : 'gap-2';
    const textSizeUser = isExpanded ? 'text-sm' : 'text-xs';
    const textSizeLabel = isExpanded ? 'text-xs' : 'text-[10px]';
    const iconSize = isExpanded ? 'text-2xl' : 'text-lg';
    const avatarSize = isExpanded ? 'w-8 h-8' : 'w-6 h-6';
    const imgMaxWidth = isExpanded ? 'max-w-sm' : 'max-w-[200px]';

    messageDiv.className = `flex items-start ${gapClass}` + (animate ? ' opacity-0' : '');

    if (role === 'user') {
        messageDiv.innerHTML = `
            <div class="mt-0.5 shrink-0">
                <div class="${avatarSize} rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                    ${currentUser ? currentUser.short_name : 'U'}
                </div>
            </div>
            <div class="flex-1">
                <div class="${textSizeLabel} text-slate-500 mb-0.5">${currentUser ? currentUser.display_name : 'You'}</div>
                ${screenshot ? `<img src="${screenshot}" class="${imgMaxWidth} rounded border border-border-dark/60 mb-1">` : ''}
                <div class="${textSizeUser} text-white leading-relaxed message-content">${escapeHTML(content)}</div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="mt-0.5 shrink-0">
                <span class="material-symbols-outlined text-primary ${iconSize}">smart_toy</span>
            </div>
            <div class="flex-1">
                <div class="${textSizeLabel} text-slate-500 mb-0.5">Claude</div>
                <div class="${textSizeUser} text-slate-300 leading-relaxed message-content whitespace-pre-wrap">${escapeHTML(content)}</div>
            </div>
        `;
    }

    messagesContainer.appendChild(messageDiv);

    if (animate) {
        setTimeout(() => {
            messageDiv.classList.remove('opacity-0');
            messageDiv.classList.add('opacity-100', 'transition-opacity', 'duration-300');
        }, 10);
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageDiv;
}

/**
 * Send message to Claude with SSE streaming (works in both widget and expanded modes)
 */
async function sendClaudeMessage() {
    const inputId = isExpanded ? 'claude-input-expanded' : 'claude-input';
    const sendBtnId = isExpanded ? 'claude-send-btn-expanded' : 'claude-send-btn';
    const typingId = isExpanded ? 'claude-typing-expanded' : 'claude-typing';

    const input = document.getElementById(inputId);
    const message = input ? input.value.trim() : '';

    if (!message) return;

    // Create session if needed
    if (!currentSessionId) {
        await createNewSession();
    }

    // Upload screenshot if attached
    let screenshotUrl = '';
    if (window.attachedScreenshot) {
        try {
            const uploadRes = await fetch('/api/claude/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: window.attachedScreenshot })
            });

            const uploadData = await uploadRes.json();
            if (uploadData.status === 'success') {
                screenshotUrl = uploadData.url;
            }
        } catch (err) {
            console.error('Screenshot upload failed:', err);
        }
    }

    // Append user message to UI
    appendMessage('user', message, window.attachedScreenshot);

    // Clear input and screenshot
    if (input) {
        input.value = '';
        input.style.height = 'auto';
    }
    removeScreenshot();

    // Disable send button
    const sendBtn = document.getElementById(sendBtnId);
    if (sendBtn) sendBtn.disabled = true;

    // Show typing indicator
    const typingIndicator = document.getElementById(typingId);
    if (typingIndicator) typingIndicator.classList.remove('hidden');

    // Get current page context
    const context = getCurrentPageContext();

    // Build SSE URL
    const params = new URLSearchParams({
        session: currentSessionId,
        message: message,
        screenshot: screenshotUrl,
        context: JSON.stringify(context)
    });

    const eventSource = new EventSource(`/api/claude/chat?${params.toString()}`);

    // Create assistant message element
    let assistantMessageEl = appendMessage('assistant', '');
    let fullResponse = '';

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'content_block_delta') {
                fullResponse += data.delta.text;
                const contentEl = assistantMessageEl.querySelector('.message-content');
                if (contentEl) {
                    contentEl.textContent = fullResponse;
                }

                // Auto-scroll
                const messagesContainer = document.getElementById('claude-messages');
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

            } else if (data.type === 'message_stop') {
                eventSource.close();

                // Hide typing indicator
                if (typingIndicator) typingIndicator.classList.add('hidden');

                // Re-enable send button
                if (sendBtn) sendBtn.disabled = false;

                // Reload session to get updated data
                setTimeout(() => loadSession(currentSessionId), 500);
            }
        } catch (err) {
            console.error('Error parsing SSE event:', err);
        }
    };

    eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        eventSource.close();

        // Hide typing indicator
        if (typingIndicator) typingIndicator.classList.add('hidden');

        // Re-enable send button
        if (sendBtn) sendBtn.disabled = false;

        // Show error message
        showToast('Error', 'Connection lost. Please try again.');

        // Append error message
        const contentEl = assistantMessageEl.querySelector('.message-content');
        if (contentEl && !contentEl.textContent.trim()) {
            contentEl.textContent = 'Sorry, there was an error connecting to Claude. Please try again.';
        }
    };
}

/**
 * Get current page context for Claude
 */
function getCurrentPageContext() {
    const activeView = document.querySelector('[id^="view-"]:not(.hidden)');
    const viewId = activeView ? activeView.id.replace('view-', '') : 'dashboard';

    const context = {
        current_page: viewId,
        timestamp: new Date().toISOString()
    };

    // Add selected item context if available
    const exhibitorPanel = document.getElementById('exhibitor-side-panel');
    if (exhibitorPanel && !exhibitorPanel.classList.contains('translate-x-full')) {
        const exhibitorId = exhibitorPanel.dataset.exhibitorId;
        if (exhibitorId) {
            context.selected_item = exhibitorId;
            context.item_type = 'exhibitor';
        }
    }

    return context;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
