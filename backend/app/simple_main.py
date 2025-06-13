from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
import asyncio
import random
from datetime import datetime
import json

# Create FastAPI app
app = FastAPI(title="AI Companion", version="1.0.0")

# Simple AI Service (no pydantic needed)
class SimpleAIService:
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
                "I'm sorry you're feeling down. Sometimes it helps to talk through what's bothering us. I'm here for you."
            ],
            'happy': [
                "That's absolutely wonderful to hear! I love seeing you in such good spirits. What's brought this joy into your day?",
                "Your happiness is contagious! I'm so glad you're feeling great. Tell me more about what's making you feel so positive!",
                "This is fantastic news! I'm genuinely excited for you. What's been the highlight of your day?"
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
            ]
        }
        
        self.question_responses = {
            'how': [
                "That's a really thoughtful question. The way I see it...",
                "Great question! Let me think about that from a few angles...",
                "I love how curious you are! Here's what I think...",
                "That's something I find fascinating. In my experience..."
            ],
            'why': [
                "That's such a deep question. I think the reason might be...",
                "You're really getting to the heart of things! I believe...",
                "That's exactly the kind of question worth exploring...",
                "I'm impressed by how you think about these things..."
            ],
            'what': [
                "That's something I've been thinking about too...",
                "Great question! From what I understand...",
                "You've touched on something really important there...",
                "That's exactly the kind of thing worth discussing..."
            ]
        }
        
        self.generic_responses = [
            "That's such an interesting perspective. I hadn't thought about it quite that way before.",
            "You've given me something to really think about. I appreciate how thoughtfully you express yourself.",
            "I find your way of looking at things really refreshing. Tell me more about your thoughts on this.",
            "That's a fascinating point. I'm curious about what led you to that conclusion.",
            "You have such a unique way of seeing things. I'd love to hear more about your perspective."
        ]
    
    def detect_emotion(self, message):
        message_lower = message.lower()
        emotions = []
        
        if any(word in message_lower for word in ['sad', 'upset', 'down', 'depressed', 'blue', 'disappointed']):
            emotions.append('sad')
        if any(word in message_lower for word in ['happy', 'joy', 'great', 'awesome', 'wonderful', 'amazing']):
            emotions.append('happy')
        if any(word in message_lower for word in ['excited', 'thrilled', 'pumped', 'enthusiastic']):
            emotions.append('excited')
        if any(word in message_lower for word in ['frustrated', 'annoyed', 'angry', 'mad', 'irritated']):
            emotions.append('frustrated')
        
        return emotions[0] if emotions else None
    
    def detect_question_type(self, message):
        message_lower = message.lower()
        if 'how' in message_lower:
            return 'how'
        elif 'why' in message_lower:
            return 'why'
        elif 'what' in message_lower:
            return 'what'
        elif message.strip().endswith('?'):
            return 'general'
        return None
    
    async def generate_response(self, message):
        # Simulate processing time
        await asyncio.sleep(random.uniform(0.3, 0.8))
        
        message_lower = message.lower()
        
        # Handle greetings
        if any(word in message_lower for word in ['hello', 'hi', 'hey', 'greetings']):
            return random.choice(self.greetings)
        
        # Detect emotions first
        emotion = self.detect_emotion(message)
        if emotion and emotion in self.emotional_responses:
            return random.choice(self.emotional_responses[emotion])
        
        # Handle questions
        question_type = self.detect_question_type(message)
        if question_type and question_type in self.question_responses:
            return random.choice(self.question_responses[question_type])
        
        # Default to thoughtful generic response
        return random.choice(self.generic_responses)

# Initialize AI service
ai_service = SimpleAIService()

# Root endpoint - serve simple chat interface
@app.get("/", response_class=HTMLResponse)
async def read_root():
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Companion - Test Version</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #0f0f0f; color: #ffffff; height: 100vh;
                display: flex; flex-direction: column;
            }
            .header { padding: 20px; background-color: #171717; border-bottom: 1px solid #333; }
            .header h1 { font-size: 24px; margin-bottom: 4px; }
            .status { font-size: 14px; color: #10b981; }
            .chat-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
            .message { max-width: 80%; display: flex; flex-direction: column; gap: 4px; }
            .user-message { align-self: flex-end; }
            .ai-message { align-self: flex-start; }
            .message-content { padding: 12px 16px; border-radius: 16px; font-size: 15px; line-height: 1.4; }
            .user-message .message-content { background-color: #2563eb; color: #ffffff; border-bottom-right-radius: 4px; }
            .ai-message .message-content { background-color: #333; color: #ffffff; border-bottom-left-radius: 4px; }
            .message-time { font-size: 12px; color: #888; margin-top: 2px; }
            .input-container { padding: 20px; background-color: #171717; border-top: 1px solid #333; }
            .input-wrapper { display: flex; gap: 12px; max-width: 800px; margin: 0 auto; }
            #messageInput { flex: 1; background-color: #333; border: 1px solid #555; color: #ffffff; padding: 12px 16px; border-radius: 12px; font-size: 15px; }
            #messageInput:focus { outline: none; border-color: #2563eb; }
            #sendBtn { background-color: #2563eb; color: #ffffff; border: none; padding: 12px 20px; border-radius: 12px; cursor: pointer; font-size: 15px; }
            #sendBtn:hover { background-color: #1d4ed8; }
            #sendBtn:disabled { background-color: #555; cursor: not-allowed; }
            .typing { color: #888; font-style: italic; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🤖 AI Companion</h1>
            <div class="status">Ready to chat - Test Version</div>
        </div>
        
        <div id="chatContainer" class="chat-container">
            <div class="message ai-message">
                <div class="message-content">
                    Hello! I'm your AI companion. I'm here to listen, learn about you, and have meaningful conversations. How are you doing today?
                </div>
                <div class="message-time">Now</div>
            </div>
        </div>
        
        <div class="input-container">
            <div class="input-wrapper">
                <input type="text" id="messageInput" placeholder="Type your message here..." />
                <button id="sendBtn">Send</button>
            </div>
        </div>
        
        <script>
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');
            const chatContainer = document.getElementById('chatContainer');
            
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
            }
            
            function showTyping() {
                const typingDiv = document.createElement('div');
                typingDiv.className = 'message ai-message';
                typingDiv.id = 'typing';
                typingDiv.innerHTML = '<div class="message-content typing">AI is thinking...</div>';
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
                sendBtn.disabled = true;
                
                addMessage(message, true);
                showTyping();
                
                try {
                    const response = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: message })
                    });
                    
                    const data = await response.json();
                    hideTyping();
                    addMessage(data.response, false);
                } catch (error) {
                    hideTyping();
                    addMessage('Sorry, I encountered an error. Please try again.', false);
                } finally {
                    sendBtn.disabled = false;
                    messageInput.focus();
                }
            }
            
            sendBtn.addEventListener('click', sendMessage);
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
            messageInput.focus();
        </script>
    </body>
    </html>
    """)

# Chat API endpoint
@app.post("/chat")
async def chat_endpoint(request: Request):
    try:
        body = await request.json()
        message = body.get('message', '')
        
        if not message:
            return JSONResponse({"error": "Message is required"}, status_code=400)
        
        # Generate AI response
        response = await ai_service.generate_response(message)
        
        return JSONResponse({
            "response": response,
            "timestamp": datetime.now().isoformat()
        })
    
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "AI Companion API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)