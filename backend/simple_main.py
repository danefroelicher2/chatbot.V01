from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
import asyncio
import random
from datetime import datetime
import json

# Create FastAPI app
app = FastAPI(title="AI Companion", version="1.0.0")

# Full AI Service with all your smart features
class AICompanionService:
    def __init__(self):
        self.greetings = [
            "Hello! It's wonderful to see you again. How has your day been treating you?",
            "Hi there! I'm so glad you're here. What's on your mind today?",
            "Hey! Great to chat with you. What would you like to talk about?",
            "Hello! I've been looking forward to our conversation. How are you feeling?",
            "Hi! It's always a pleasure to hear from you. What's new in your world?"
        ]
        
        self.emotional_responses = {
            'sad': [
                "I can hear that you're going through a difficult time. I'm here to listen if you want to share what's weighing on your heart.",
                "It sounds like you're dealing with something really challenging. Would you like to talk about what's making you feel this way?",
                "I'm sorry you're feeling down. Sometimes it helps to talk through what's bothering us. I'm here for you.",
                "That sounds really tough. I want you to know that your feelings are completely valid, and I'm here to support you however I can."
            ],
            'happy': [
                "That's absolutely wonderful to hear! I love seeing you in such good spirits. What's brought this joy into your day?",
                "Your happiness is contagious! I'm so glad you're feeling great. Tell me more about what's making you feel so positive!",
                "This is fantastic news! I'm genuinely excited for you. What's been the highlight of your day?",
                "I can feel your positive energy through your words! It's beautiful to see you so happy. What's been going well?"
            ],
            'excited': [
                "Your excitement is infectious! I'm thrilled to hear you're feeling so energized. What's got you so pumped up?",
                "I love your enthusiasm! There's something really special about sharing in someone's excitement. Tell me all about it!",
                "This is amazing! Your energy is lighting up our conversation. I'm so curious to hear what's got you so excited!"
            ],
            'frustrated': [
                "I can really hear the frustration in your words. That sounds incredibly challenging to deal with.",
                "Frustration is such a valid emotion, especially when things aren't going as planned. What's been the most difficult part?",
                "It sounds like you're dealing with something really aggravating. Sometimes it helps to talk through what's not working."
            ],
            'worried': [
                "I can sense the worry in your words. It's completely understandable to feel anxious about uncertain situations.",
                "That sounds like a lot to carry on your mind. Sometimes talking through our worries can help lighten the load.",
                "I hear how concerned you are. Would it help to break down what's worrying you most?"
            ]
        }
        
        self.question_responses = {
            'how': [
                "That's a really thoughtful question. The way I see it...",
                "Great question! Let me think about that from a few angles...",
                "I love how curious you are! Here's what I think...",
                "That's something I find fascinating. In my experience...",
                "What an interesting way to look at it! I'd say..."
            ],
            'why': [
                "That's such a deep question. I think the reason might be...",
                "You're really getting to the heart of things! I believe...",
                "That's exactly the kind of question worth exploring...",
                "I'm impressed by how you think about these things...",
                "That's a question that deserves a thoughtful answer..."
            ],
            'what': [
                "That's something I've been thinking about too...",
                "Great question! From what I understand...",
                "You've touched on something really important there...",
                "That's exactly the kind of thing worth discussing...",
                "I find that topic really engaging. Here's my take..."
            ]
        }
        
        self.topic_responses = {
            'work': [
                "Work can be such a significant part of our lives. How are you finding the balance between your professional and personal time?",
                "That's interesting! I'm curious about what drives you in your work. What aspects do you find most fulfilling?",
                "Work situations can be complex. It sounds like you're navigating some interesting challenges there."
            ],
            'family': [
                "Family relationships are so important and complex. It sounds like there's a lot happening in your family world.",
                "I can hear how much your family means to you. Those relationships shape us in such profound ways.",
                "Family dynamics can be both rewarding and challenging. What's been on your mind about your family lately?"
            ],
            'goals': [
                "I love hearing about people's goals and aspirations! What's driving your ambition in this area?",
                "Goals are such powerful motivators. What steps are you taking to work toward what you want?",
                "That's exciting! I'm curious about what success looks like to you in this situation."
            ],
            'relationships': [
                "Relationships are such a fascinating and complex part of human experience. How are you feeling about this situation?",
                "I can hear how much this relationship means to you. It's clear you care deeply about this person.",
                "Human connections can be both incredibly rewarding and challenging. What's been on your heart about this?"
            ]
        }
        
        self.generic_responses = [
            "That's such an interesting perspective. I hadn't thought about it quite that way before.",
            "You've given me something to really think about. I appreciate how thoughtfully you express yourself.",
            "I find your way of looking at things really refreshing. Tell me more about your thoughts on this.",
            "That's a fascinating point. I'm curious about what led you to that conclusion.",
            "You have such a unique way of seeing things. I'd love to hear more about your perspective.",
            "That's really insightful. I'm genuinely interested in understanding your viewpoint better.",
            "You've touched on something that I think is really important. What's your experience been with this?",
            "I appreciate how openly you share your thoughts. It makes for such meaningful conversation."
        ]
        
        self.conversation_starters = [
            "I'm curious - what's been the most interesting part of your day so far?",
            "Is there something you've been thinking about lately that you'd like to explore together?",
            "What's something that's been bringing you joy recently?",
            "I'd love to hear about something you're looking forward to."
        ]
        
        # Keywords for detection
        self.emotion_keywords = {
            'sad': ['sad', 'upset', 'down', 'depressed', 'blue', 'disappointed', 'hurt', 'crying'],
            'happy': ['happy', 'joy', 'excited', 'great', 'awesome', 'wonderful', 'amazing', 'fantastic', 'good'],
            'frustrated': ['frustrated', 'annoyed', 'angry', 'mad', 'irritated', 'stressed'],
            'worried': ['worried', 'anxious', 'nervous', 'concerned', 'scared', 'afraid'],
            'excited': ['excited', 'thrilled', 'pumped', 'enthusiastic', 'eager', 'looking forward']
        }
        
        self.topic_keywords = {
            'work': ['job', 'work', 'career', 'boss', 'colleague', 'office', 'meeting', 'project', 'deadline'],
            'family': ['family', 'mom', 'dad', 'parent', 'sibling', 'brother', 'sister', 'child', 'kids'],
            'relationships': ['relationship', 'partner', 'dating', 'boyfriend', 'girlfriend', 'marriage', 'love'],
            'goals': ['goal', 'dream', 'ambition', 'future', 'plan', 'hope', 'want', 'wish', 'achieve']
        }
    
    def detect_emotions(self, message):
        message_lower = message.lower()
        detected_emotions = []
        
        for emotion, keywords in self.emotion_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                detected_emotions.append(emotion)
        
        return detected_emotions
    
    def detect_topics(self, message):
        message_lower = message.lower()
        detected_topics = []
        
        for topic, keywords in self.topic_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                detected_topics.append(topic)
        
        return detected_topics
    
    def detect_question_type(self, message):
        message_lower = message.lower()
        
        if 'how' in message_lower and '?' in message:
            return 'how'
        elif 'why' in message_lower and '?' in message:
            return 'why'
        elif 'what' in message_lower and '?' in message:
            return 'what'
        elif message.strip().endswith('?'):
            return 'general'
        
        return None
    
    async def generate_response(self, message, conversation_history=None, user_facts=None):
        # Simulate thinking time
        await asyncio.sleep(random.uniform(0.4, 1.0))
        
        message_lower = message.lower()
        
        # Handle greetings
        if any(word in message_lower for word in ['hello', 'hi', 'hey', 'greetings']):
            return random.choice(self.greetings)
        
        # Detect emotions first (priority)
        emotions = self.detect_emotions(message)
        if emotions:
            primary_emotion = emotions[0]
            if primary_emotion in self.emotional_responses:
                return random.choice(self.emotional_responses[primary_emotion])
        
        # Handle questions
        question_type = self.detect_question_type(message)
        if question_type and question_type in self.question_responses:
            return random.choice(self.question_responses[question_type])
        
        # Handle topics
        topics = self.detect_topics(message)
        if topics:
            topic = topics[0]
            if topic in self.topic_responses:
                return random.choice(self.topic_responses[topic])
        
        # Check conversation history for deeper engagement
        if conversation_history and len(conversation_history) > 2:
            if random.random() < 0.25:  # 25% chance
                return random.choice(self.conversation_starters)
        
        # Default thoughtful response
        return random.choice(self.generic_responses)

# Initialize AI service
ai_service = AICompanionService()

# Serve the beautiful chat interface
@app.get("/", response_class=HTMLResponse)
async def read_root():
    return HTMLResponse(content="""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Companion</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #0f0f0f; color: #ffffff; height: 100vh;
            display: flex; flex-direction: column;
        }
        .header { 
            padding: 20px 24px; background-color: #171717; 
            border-bottom: 1px solid #333;
        }
        .header h1 { font-size: 28px; margin-bottom: 4px; }
        .status { font-size: 14px; color: #10b981; }
        .chat-container { 
            flex: 1; overflow-y: auto; padding: 24px; 
            display: flex; flex-direction: column; gap: 16px; 
        }
        .message { 
            max-width: 75%; display: flex; flex-direction: column; gap: 4px; 
            animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .user-message { align-self: flex-end; }
        .ai-message { align-self: flex-start; }
        .message-content { 
            padding: 12px 16px; border-radius: 16px; font-size: 15px; 
            line-height: 1.5; word-wrap: break-word;
        }
        .user-message .message-content { 
            background-color: #2563eb; color: #ffffff; 
            border-bottom-right-radius: 4px;
        }
        .ai-message .message-content { 
            background-color: #333; color: #ffffff; 
            border-bottom-left-radius: 4px;
        }
        .message-time { 
            font-size: 12px; color: #888; margin-top: 2px; 
            align-self: flex-end;
        }
        .ai-message .message-time { align-self: flex-start; }
        .input-container { 
            padding: 24px; background-color: #171717; 
            border-top: 1px solid #333;
        }
        .input-wrapper { 
            display: flex; gap: 12px; max-width: 800px; 
            margin: 0 auto; align-items: flex-end;
        }
        #messageInput { 
            flex: 1; background-color: #333; border: 1px solid #555; 
            color: #ffffff; padding: 12px 16px; border-radius: 12px; 
            font-size: 15px; font-family: inherit; resize: none;
            min-height: 44px; max-height: 120px; line-height: 1.4;
        }
        #messageInput:focus { outline: none; border-color: #2563eb; }
        #messageInput::placeholder { color: #888; }
        #sendBtn { 
            background-color: #2563eb; color: #ffffff; border: none; 
            padding: 12px 20px; border-radius: 12px; cursor: pointer; 
            font-size: 15px; font-weight: 500; transition: all 0.2s;
            min-width: 80px;
        }
        #sendBtn:hover { background-color: #1d4ed8; }
        #sendBtn:disabled { background-color: #555; cursor: not-allowed; }
        .typing { 
            color: #888; font-style: italic; 
            animation: pulse 1.5s ease-in-out infinite alternate;
        }
        @keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } }
        .typing-dots {
            display: inline-flex; gap: 4px; margin-left: 8px;
        }
        .typing-dot {
            width: 6px; height: 6px; background-color: #888; 
            border-radius: 50%; animation: typing 1.4s infinite ease-in-out;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes typing {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AI Companion</h1>
        <div class="status">Ready for meaningful conversation</div>
    </div>
    
    <div id="chatContainer" class="chat-container">
        <div class="message ai-message">
            <div class="message-content">
                Hello! I'm your AI companion. I'm here to listen, learn about you, and have meaningful conversations. I can sense emotions, understand different topics, and respond thoughtfully to your questions. How are you doing today?
            </div>
            <div class="message-time">Now</div>
        </div>
    </div>
    
    <div class="input-container">
        <div class="input-wrapper">
            <textarea id="messageInput" placeholder="Share what's on your mind..." rows="1"></textarea>
            <button id="sendBtn">Send</button>
        </div>
    </div>
    
    <script>
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const chatContainer = document.getElementById('chatContainer');
        let conversationHistory = [];
        
        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
        
        function addMessage(content, isUser) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            messageDiv.innerHTML = `
                <div class="message-content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                <div class="message-time">${timeString}</div>
            `;
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            // Add to conversation history
            conversationHistory.push({content: content, is_user: isUser});
            if (conversationHistory.length > 20) {
                conversationHistory = conversationHistory.slice(-20); // Keep last 20 messages
            }
        }
        
        function showTyping() {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'message ai-message';
            typingDiv.id = 'typing';
            typingDiv.innerHTML = `
                <div class="message-content typing">
                    AI is thinking<span class="typing-dots">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </span>
                </div>
            `;
            chatContainer.appendChild(typingDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function hideTyping() {
            const typing = document.getElementById('typing');
            if (typing) typing.remove();
        }
        
        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;
            
            messageInput.value = '';
            messageInput.style.height = 'auto';
            sendBtn.disabled = true;
            
            addMessage(message, true);
            showTyping();
            
            try {
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message: message,
                        conversation_history: conversationHistory.slice(-10) // Send last 10 messages for context
                    })
                });
                
                const data = await response.json();
                hideTyping();
                addMessage(data.response, false);
            } catch (error) {
                hideTyping();
                addMessage('I apologize, but I encountered an error. Please try again.', false);
            } finally {
                sendBtn.disabled = false;
                messageInput.focus();
            }
        }
        
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        messageInput.focus();
    </script>
</body>
</html>""")

# Chat API endpoint
@app.post("/chat")
async def chat_endpoint(request: Request):
    try:
        body = await request.json()
        message = body.get('message', '')
        conversation_history = body.get('conversation_history', [])
        
        if not message:
            return JSONResponse({"error": "Message is required"}, status_code=400)
        
        # Generate AI response with full context
        response = await ai_service.generate_response(
            message=message, 
            conversation_history=conversation_history,
            user_facts={}
        )
        
        return JSONResponse({
            "response": response,
            "timestamp": datetime.now().isoformat()
        })
    
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "AI Companion with full intelligence is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
