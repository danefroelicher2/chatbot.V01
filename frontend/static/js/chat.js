class EnhancedChatApp {
  constructor() {
    this.currentConversationId = null;
    this.userId = 1;
    this.conversationMetadata = {};
    this.userProfile = null;

    this.initializeElements();
    this.attachEventListeners();
    this.loadUserProfile();
    this.loadConversations();
    this.setupEmotionDetection();
  }

  initializeElements() {
    this.messageInput = document.getElementById("messageInput");
    this.sendBtn = document.getElementById("sendBtn");
    this.chatMessages = document.getElementById("chatMessages");
    this.conversationList = document.getElementById("conversationList");
    this.newChatBtn = document.getElementById("newChatBtn");

    // Create new UI elements
    this.createEmotionIndicator();
    this.createTypingAnalyzer();
    this.createConversationInsights();
  }

  createEmotionIndicator() {
    const emotionDiv = document.createElement("div");
    emotionDiv.id = "emotionIndicator";
    emotionDiv.className = "emotion-indicator";
    emotionDiv.innerHTML = `
            <div class="emotion-display">
                <span class="emotion-label">Mood:</span>
                <span class="emotion-value" id="currentEmotion">Neutral</span>
                <div class="emotion-intensity" id="emotionIntensity"></div>
            </div>
        `;

    const chatHeader = document.querySelector(".chat-header");
    chatHeader.appendChild(emotionDiv);
  }

  createTypingAnalyzer() {
    const analyzerDiv = document.createElement("div");
    analyzerDiv.id = "typingAnalyzer";
    analyzerDiv.className = "typing-analyzer";
    analyzerDiv.innerHTML = `
            <div class="analysis-indicators">
                <span class="topic-hint" id="topicHint"></span>
                <span class="sentiment-meter" id="sentimentMeter"></span>
            </div>
        `;

    const inputContainer = document.querySelector(".chat-input-container");
    inputContainer.insertBefore(analyzerDiv, inputContainer.firstChild);
  }

  createConversationInsights() {
    const insightsDiv = document.createElement("div");
    insightsDiv.id = "conversationInsights";
    insightsDiv.className = "conversation-insights";
    insightsDiv.innerHTML = `
            <div class="insights-header">
                <h3>Conversation Insights</h3>
                <button id="toggleInsights" class="toggle-btn">Hide</button>
            </div>
            <div class="insights-content">
                <div class="insight-item">
                    <span class="insight-label">Topics Discussed:</span>
                    <span class="insight-value" id="discussedTopics">None yet</span>
                </div>
                <div class="insight-item">
                    <span class="insight-label">Emotional Journey:</span>
                    <div class="emotion-timeline" id="emotionTimeline"></div>
                </div>
                <div class="insight-item">
                    <span class="insight-label">Facts Learned:</span>
                    <span class="insight-value" id="factsLearned">0</span>
                </div>
            </div>
        `;

    const sidebar = document.querySelector(".sidebar");
    sidebar.appendChild(insightsDiv);
  }

  attachEventListeners() {
    // Existing event listeners
    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.messageInput.addEventListener("input", () => {
      this.autoResizeTextarea();
      this.analyzeTyping();
    });
    this.newChatBtn.addEventListener("click", () => this.startNewChat());

    // New event listeners
    document
      .getElementById("toggleInsights")
      ?.addEventListener("click", () => this.toggleInsights());
  }

  setupEmotionDetection() {
    // Real-time emotion detection keywords
    this.emotionKeywords = {
      happy: [
        "happy",
        "joy",
        "great",
        "awesome",
        "wonderful",
        "amazing",
        "fantastic",
        "good",
        "excited",
      ],
      sad: [
        "sad",
        "upset",
        "down",
        "depressed",
        "disappointed",
        "hurt",
        "crying",
      ],
      frustrated: [
        "frustrated",
        "annoyed",
        "angry",
        "mad",
        "irritated",
        "stressed",
      ],
      worried: [
        "worried",
        "anxious",
        "nervous",
        "concerned",
        "scared",
        "afraid",
      ],
      excited: ["excited", "thrilled", "pumped", "enthusiastic", "eager"],
    };

    this.topicKeywords = {
      work: [
        "job",
        "work",
        "career",
        "boss",
        "colleague",
        "office",
        "meeting",
        "project",
      ],
      family: [
        "family",
        "mom",
        "dad",
        "parent",
        "sibling",
        "brother",
        "sister",
      ],
      relationships: [
        "relationship",
        "partner",
        "dating",
        "boyfriend",
        "girlfriend",
      ],
      health: ["health", "doctor", "sick", "exercise", "diet", "sleep"],
      goals: ["goal", "dream", "ambition", "future", "plan", "hope"],
    };
  }

  analyzeTyping() {
    const text = this.messageInput.value.toLowerCase();
    if (text.length < 3) {
      this.clearAnalysis();
      return;
    }

    // Detect emotions in real-time
    const detectedEmotion = this.detectEmotionInText(text);
    if (detectedEmotion) {
      this.updateEmotionIndicator(detectedEmotion);
    }

    // Detect topics
    const detectedTopics = this.detectTopicsInText(text);
    this.updateTopicHint(detectedTopics);

    // Calculate sentiment
    const sentiment = this.calculateSentiment(text);
    this.updateSentimentMeter(sentiment);
  }

  detectEmotionInText(text) {
    for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return emotion;
        }
      }
    }
    return null;
  }

  detectTopicsInText(text) {
    const topics = [];
    for (const [topic, keywords] of Object.entries(this.topicKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          topics.push(topic);
          break;
        }
      }
    }
    return topics;
  }

  calculateSentiment(text) {
    const positiveWords = [
      "good",
      "great",
      "happy",
      "love",
      "wonderful",
      "amazing",
      "perfect",
      "excellent",
    ];
    const negativeWords = [
      "bad",
      "terrible",
      "hate",
      "awful",
      "horrible",
      "worst",
      "disappointed",
      "frustrated",
    ];

    let score = 0;
    positiveWords.forEach((word) => {
      if (text.includes(word)) score += 1;
    });
    negativeWords.forEach((word) => {
      if (text.includes(word)) score -= 1;
    });

    return Math.max(-1, Math.min(1, score / 3));
  }

  updateEmotionIndicator(emotion) {
    const emotionElement = document.getElementById("currentEmotion");
    const intensityElement = document.getElementById("emotionIntensity");

    if (emotionElement) {
      emotionElement.textContent =
        emotion.charAt(0).toUpperCase() + emotion.slice(1);
      emotionElement.className = `emotion-value emotion-${emotion}`;
    }

    if (intensityElement) {
      intensityElement.innerHTML = `<div class="intensity-bar emotion-${emotion}"></div>`;
    }
  }

  updateTopicHint(topics) {
    const topicHint = document.getElementById("topicHint");
    if (topicHint && topics.length > 0) {
      topicHint.textContent = `Discussing: ${topics.join(", ")}`;
      topicHint.style.display = "block";
    } else if (topicHint) {
      topicHint.style.display = "none";
    }
  }

  updateSentimentMeter(sentiment) {
    const sentimentMeter = document.getElementById("sentimentMeter");
    if (sentimentMeter) {
      const percentage = ((sentiment + 1) / 2) * 100;
      const color =
        sentiment > 0.2 ? "#10b981" : sentiment < -0.2 ? "#ef4444" : "#6b7280";
      sentimentMeter.innerHTML = `
                <div class="sentiment-bar">
                    <div class="sentiment-fill" style="width: ${percentage}%; background-color: ${color};"></div>
                </div>
                <span class="sentiment-label">${
                  sentiment > 0.2
                    ? "Positive"
                    : sentiment < -0.2
                    ? "Negative"
                    : "Neutral"
                }</span>
            `;
    }
  }

  clearAnalysis() {
    document.getElementById("topicHint")?.style.setProperty("display", "none");
    document.getElementById("currentEmotion").textContent = "Neutral";
    document.getElementById("emotionIntensity").innerHTML = "";
    document.getElementById("sentimentMeter").innerHTML = "";
  }

  autoResizeTextarea() {
    this.messageInput.style.height = "auto";
    this.messageInput.style.height =
      Math.min(this.messageInput.scrollHeight, 120) + "px";
  }

  async sendMessage() {
    const message = this.messageInput.value.trim();
    if (!message) return;

    // Clear input and disable send button
    this.messageInput.value = "";
    this.messageInput.style.height = "auto";
    this.sendBtn.disabled = true;
    this.clearAnalysis();

    // Add user message to chat
    this.addMessage(message, true);
    this.showTypingIndicator();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message,
          user_id: this.userId,
          conversation_id: this.currentConversationId,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const data = await response.json();

      // Update conversation metadata
      this.conversationMetadata = {
        emotions: data.detected_emotions,
        topics: data.detected_topics,
        intent: data.intent,
        sentiment: data.sentiment_score,
        factsLearned: data.new_facts_learned,
      };

      // Update current conversation ID
      if (!this.currentConversationId) {
        this.currentConversationId = data.conversation_id;
        this.loadConversations();
      }

      // Remove typing indicator and add AI response
      this.hideTypingIndicator();
      this.addEnhancedMessage(data.response, false, data);

      // Update insights
      this.updateConversationInsights(data);

      // Show conversation summary if available
      if (data.conversation_summary) {
        this.showConversationSummary(data.conversation_summary);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      this.hideTypingIndicator();
      this.addMessage(
        "Sorry, I encountered an error. Please try again.",
        false
      );
    } finally {
      this.sendBtn.disabled = false;
      this.messageInput.focus();
    }
  }

  addMessage(content, isUser) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user-message" : "ai-message"}`;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(content)}</div>
            <div class="message-time">${timeString}</div>
        `;

    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  addEnhancedMessage(content, isUser, metadata = null) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user-message" : "ai-message"}`;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    let metadataHtml = "";
    if (metadata && !isUser) {
      metadataHtml = `
                <div class="message-metadata">
                    ${
                      metadata.detected_emotions?.length
                        ? `<span class="emotion-tag">${metadata.detected_emotions[0].emotion}</span>`
                        : ""
                    }
                    ${
                      metadata.detected_topics?.length
                        ? `<span class="topic-tag">${metadata.detected_topics.join(
                            ", "
                          )}</span>`
                        : ""
                    }
                    ${
                      metadata.new_facts_learned > 0
                        ? `<span class="facts-tag">+${metadata.new_facts_learned} facts</span>`
                        : ""
                    }
                </div>
            `;
    }

    messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(content)}</div>
            ${metadataHtml}
            <div class="message-time">${timeString}</div>
        `;

    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  updateConversationInsights(data) {
    // Update topics discussed
    const topicsElement = document.getElementById("discussedTopics");
    if (topicsElement && data.detected_topics?.length) {
      const allTopics = new Set();
      if (this.conversationMetadata.allTopics) {
        this.conversationMetadata.allTopics.forEach((topic) =>
          allTopics.add(topic)
        );
      }
      data.detected_topics.forEach((topic) => allTopics.add(topic));
      this.conversationMetadata.allTopics = Array.from(allTopics);
      topicsElement.textContent =
        Array.from(allTopics).join(", ") || "None yet";
    }

    // Update emotion timeline
    const timelineElement = document.getElementById("emotionTimeline");
    if (timelineElement && data.detected_emotions?.length) {
      if (!this.conversationMetadata.emotionHistory) {
        this.conversationMetadata.emotionHistory = [];
      }

      this.conversationMetadata.emotionHistory.push({
        emotion: data.detected_emotions[0].emotion,
        intensity: data.detected_emotions[0].intensity,
        timestamp: new Date(),
      });

      this.renderEmotionTimeline(timelineElement);
    }

    // Update facts learned
    const factsElement = document.getElementById("factsLearned");
    if (factsElement) {
      if (!this.conversationMetadata.totalFacts) {
        this.conversationMetadata.totalFacts = 0;
      }
      this.conversationMetadata.totalFacts += data.new_facts_learned || 0;
      factsElement.textContent = this.conversationMetadata.totalFacts;
    }
  }

  renderEmotionTimeline(container) {
    const emotions = this.conversationMetadata.emotionHistory || [];
    const recentEmotions = emotions.slice(-5); // Show last 5 emotions

    container.innerHTML = recentEmotions
      .map(
        (emotion) => `
            <span class="emotion-bubble emotion-${emotion.emotion}" title="${
          emotion.emotion
        } (${emotion.intensity})">
                ${emotion.emotion.charAt(0).toUpperCase()}
            </span>
        `
      )
      .join("");
  }

  showConversationSummary(summary) {
    const summaryDiv = document.createElement("div");
    summaryDiv.className = "conversation-summary";
    summaryDiv.innerHTML = `
            <div class="summary-header">
                <h4>💡 Conversation Summary</h4>
                <button class="close-summary">×</button>
            </div>
            <div class="summary-content">
                <p><strong>Messages:</strong> ${summary.message_count}</p>
                <p><strong>Main Topics:</strong> ${Object.keys(
                  summary.main_topics || {}
                ).join(", ")}</p>
                <p><strong>Emotional Journey:</strong> ${
                  summary.emotional_journey?.length || 0
                } emotional shifts</p>
            </div>
        `;

    summaryDiv.querySelector(".close-summary").addEventListener("click", () => {
      summaryDiv.remove();
    });

    this.chatMessages.appendChild(summaryDiv);
    this.scrollToBottom();

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (summaryDiv.parentNode) {
        summaryDiv.remove();
      }
    }, 10000);
  }

  showTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.className = "message ai-message typing-indicator";
    typingDiv.id = "typingIndicator";

    typingDiv.innerHTML = `
            <div class="typing-content">
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
                <span class="typing-text">AI is thinking...</span>
            </div>
        `;

    this.chatMessages.appendChild(typingDiv);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const typingIndicator = document.getElementById("typingIndicator");
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  async loadUserProfile() {
    try {
      const response = await fetch(`/api/user/${this.userId}/profile`);
      if (response.ok) {
        this.userProfile = await response.json();
        this.updateUserProfileDisplay();
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  }

  updateUserProfileDisplay() {
    if (!this.userProfile) return;

    // Update chat header with user info
    const statusElement = document.querySelector(".status");
    if (statusElement && this.userProfile.name) {
      statusElement.textContent = `Hi ${this.userProfile.name}! Ready to chat`;
    }

    // Update insights with user stats
    const insightsContent = document.querySelector(".insights-content");
    if (insightsContent && this.userProfile.facts_count > 0) {
      const userStatsDiv = document.createElement("div");
      userStatsDiv.className = "insight-item user-stats";
      userStatsDiv.innerHTML = `
                <span class="insight-label">What I know about you:</span>
                <span class="insight-value">${this.userProfile.facts_count} facts</span>
            `;
      insightsContent.appendChild(userStatsDiv);
    }
  }

  async loadConversations() {
    try {
      const response = await fetch(`/api/conversations?user_id=${this.userId}`);
      if (!response.ok) throw new Error("Failed to load conversations");

      const conversations = await response.json();
      this.renderConversations(conversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  }

  renderConversations(conversations) {
    this.conversationList.innerHTML = "";

    conversations.forEach((conv) => {
      const convDiv = document.createElement("div");
      convDiv.className = "conversation-item";
      if (conv.id === this.currentConversationId) {
        convDiv.classList.add("active");
      }

      const timeString = new Date(conv.last_message_at).toLocaleDateString();
      const emotionIndicator = conv.dominant_emotion
        ? `<span class="conv-emotion emotion-${conv.dominant_emotion}">●</span>`
        : "";
      const themesDisplay = conv.themes?.length
        ? `<div class="conv-themes">${conv.themes.slice(0, 2).join(", ")}</div>`
        : "";

      convDiv.innerHTML = `
                <div class="conversation-title">
                    ${emotionIndicator}
                    ${this.escapeHtml(conv.title)}
                </div>
                ${themesDisplay}
                <div class="conversation-time">${timeString} • ${
        conv.message_count
      } messages</div>
            `;

      convDiv.addEventListener("click", () => this.loadConversation(conv.id));
      this.conversationList.appendChild(convDiv);
    });
  }

  async loadConversation(conversationId) {
    try {
      this.currentConversationId = conversationId;

      // Update UI to show active conversation
      document.querySelectorAll(".conversation-item").forEach((item) => {
        item.classList.remove("active");
      });
      event.target.closest(".conversation-item").classList.add("active");

      // Load messages with enhanced metadata
      const response = await fetch(
        `/api/conversation/${conversationId}/messages?user_id=${this.userId}`
      );
      if (!response.ok) throw new Error("Failed to load conversation");

      const messages = await response.json();

      // Clear current messages and load conversation history
      this.chatMessages.innerHTML = "";
      this.conversationMetadata = {
        allTopics: [],
        emotionHistory: [],
        totalFacts: 0,
      };

      messages.forEach((msg) => {
        this.addEnhancedMessage(msg.content, msg.is_user, {
          detected_emotions: msg.detected_emotions,
          detected_topics: msg.detected_topics,
          sentiment_score: msg.sentiment_score,
        });

        // Rebuild metadata for insights
        if (msg.is_user && msg.detected_topics?.length) {
          msg.detected_topics.forEach((topic) => {
            if (!this.conversationMetadata.allTopics.includes(topic)) {
              this.conversationMetadata.allTopics.push(topic);
            }
          });
        }

        if (msg.is_user && msg.detected_emotions?.length) {
          this.conversationMetadata.emotionHistory.push({
            emotion: msg.detected_emotions[0].emotion,
            intensity: msg.detected_emotions[0].intensity,
            timestamp: new Date(msg.timestamp),
          });
        }
      });

      // Update insights display
      this.updateInsightsFromHistory();
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  }

  updateInsightsFromHistory() {
    // Update topics
    const topicsElement = document.getElementById("discussedTopics");
    if (topicsElement) {
      topicsElement.textContent =
        this.conversationMetadata.allTopics.join(", ") || "None yet";
    }

    // Update emotion timeline
    const timelineElement = document.getElementById("emotionTimeline");
    if (timelineElement) {
      this.renderEmotionTimeline(timelineElement);
    }
  }

  startNewChat() {
    this.currentConversationId = null;
    this.conversationMetadata = {
      allTopics: [],
      emotionHistory: [],
      totalFacts: 0,
    };

    this.chatMessages.innerHTML = `
            <div class="message ai-message">
                <div class="message-content">
                    Hello! I'm your enhanced AI companion. I can understand your emotions, learn about you, and have meaningful conversations. I'll track our discussion topics and remember important facts about you. How are you feeling today?
                </div>
                <div class="message-time">Now</div>
            </div>
        `;

    // Clear insights
    document.getElementById("discussedTopics").textContent = "None yet";
    document.getElementById("emotionTimeline").innerHTML = "";
    document.getElementById("factsLearned").textContent = "0";

    // Remove active state from all conversations
    document.querySelectorAll(".conversation-item").forEach((item) => {
      item.classList.remove("active");
    });

    this.messageInput.focus();
  }

  toggleInsights() {
    const insightsContent = document.querySelector(".insights-content");
    const toggleBtn = document.getElementById("toggleInsights");

    if (insightsContent.style.display === "none") {
      insightsContent.style.display = "block";
      toggleBtn.textContent = "Hide";
    } else {
      insightsContent.style.display = "none";
      toggleBtn.textContent = "Show";
    }
  }
}

// Initialize the enhanced chat app when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new EnhancedChatApp();
});
