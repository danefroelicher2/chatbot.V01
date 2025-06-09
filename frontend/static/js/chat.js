class ChatApp {
    constructor() {
        this.currentConversationId = null;
        this.userId = 1; // Default user ID
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadConversations();
    }
    
    initializeElements() {
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.conversationList = document.getElementById('conversationList');
        this.newChatBtn = document.getElementById('newChatBtn');
    }
    
    attachEventListeners() {
        // Send message on button click
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Send message on Enter key (Shift+Enter for new line)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });
        
        // New chat button
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
    }
    
    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        // Clear input and disable send button
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.sendBtn.disabled = true;
        
        // Add user message to chat
        this.addMessage(message, true);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send message to API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    user_id: this.userId,
                    conversation_id: this.currentConversationId
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            
            const data = await response.json();
            
            // Update current conversation ID if this was a new conversation
            if (!this.currentConversationId) {
                this.currentConversationId = data.conversation_id;
                this.loadConversations(); // Refresh conversation list
            }
            
            // Remove typing indicator and add AI response
            this.hideTypingIndicator();
            this.addMessage(data.response, false);
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', false);
        } finally {
            this.sendBtn.disabled = false;
            this.messageInput.focus();
        }
    }
    
    addMessage(content, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(content)}</div>
            <div class="message-time">${timeString}</div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message typing-indicator';
        typingDiv.id = 'typingIndicator';
        
        typingDiv.innerHTML = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async loadConversations() {
        try {
            const response = await fetch(`/api/conversations?user_id=${this.userId}`);
            if (!response.ok) throw new Error('Failed to load conversations');
            
            const conversations = await response.json();
            this.renderConversations(conversations);
            
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    }
    
    renderConversations(conversations) {
        this.conversationList.innerHTML = '';
        
        conversations.forEach(conv => {
            const convDiv = document.createElement('div');
            convDiv.className = 'conversation-item';
            if (conv.id === this.currentConversationId) {
                convDiv.classList.add('active');
            }
            
            const timeString = new Date(conv.last_message_at).toLocaleDateString();
            
            convDiv.innerHTML = `
                <div class="conversation-title">${this.escapeHtml(conv.title)}</div>
                <div class="conversation-time">${timeString} • ${conv.message_count} messages</div>
            `;
            
            convDiv.addEventListener('click', () => this.loadConversation(conv.id));
            this.conversationList.appendChild(convDiv);
        });
    }
    
    async loadConversation(conversationId) {
        try {
            // Update active conversation
            this.currentConversationId = conversationId;
            
            // Update UI to show active conversation
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.closest('.conversation-item').classList.add('active');
            
            // Load messages
            const response = await fetch(`/api/conversation/${conversationId}/messages?user_id=${this.userId}`);
            if (!response.ok) throw new Error('Failed to load conversation');
            
            const messages = await response.json();
            
            // Clear current messages and load conversation history
            this.chatMessages.innerHTML = '';
            messages.forEach(msg => {
                this.addMessage(msg.content, msg.is_user);
            });
            
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    }
    
    startNewChat() {
        this.currentConversationId = null;
        this.chatMessages.innerHTML = `
            <div class="message ai-message">
                <div class="message-content">
                    Hello! I'm your AI companion. I'm here to listen, learn about you, and have meaningful conversations. How are you doing today?
                </div>
                <div class="message-time">Now</div>
            </div>
        `;
        
        // Remove active state from all conversations
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        this.messageInput.focus();
    }
}

// Initialize the chat app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});