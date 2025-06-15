"""
Contextual AI Companion - Test the new context-aware response system
This version analyzes what you actually say and responds to the content
"""

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
import asyncio
import random
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

# Create FastAPI app
app = FastAPI(title="Contextual AI Companion", version="3.0.0")

# Simple storage
storage = {}

class ContextualAI:
    def __init__(self):
        self.acknowledgments = [
            "I hear you saying", "It sounds like", "I can sense that", 
            "What I'm understanding is", "It seems like", "I'm picking up that"
        ]
        
        self.empathy_starters = [
            "That must be", "I imagine that feels", "It sounds like that's",
            "I can understand why that would be", "That seems like it would be", "I bet that's"
        ]
    
    def analyze_message(self, message: str) -> Dict[str, Any]:
        """Analyze what the user is actually talking about"""
        message_lower = message.lower()
        
        # What's the main subject?
        main_subject = "general"
        if any(word in message_lower for word in ['work', 'job', 'boss', 'office']):
            main_subject = "work"
        elif any(word in message_lower for word in ['family', 'mom', 'dad', 'parents']):
            main_subject = "family"
        elif any(word in message_lower for word in ['friend', 'friendship', 'buddy']):
            main_subject = "friendship"
        elif any(word in message_lower for word in ['relationship', 'partner', 'boyfriend', 'girlfriend']):
            main_subject = "relationship"
        elif any(word in message_lower for word in ['school', 'college', 'class', 'teacher']):
            main_subject = "school"
        
        # What emotions are present?
        emotions = []
        if any(word in message_lower for word in ['frustrated', 'annoyed', 'angry', 'mad', 'irritated']):
            emotions.append('frustrated')
        if any(word in message_lower for word in ['sad', 'upset', 'down', 'depressed', 'disappointed']):
            emotions.append('sad')
        if any(word in message_lower for word in ['happy', 'excited', 'thrilled', 'great', 'awesome']):
            emotions.append('happy')
        if any(word in message_lower for word in ['worried', 'anxious', 'nervous', 'scared', 'concerned']):
            emotions.append('worried')
        if any(word in message_lower for word in ['confused', 'lost', 'don\'t understand', 'unclear']):
            emotions.append('confused')
        
        # What's the emotional intensity?
        intensity = "medium"
        if any(word in message_lower for word in ['really', 'very', 'extremely', 'so', 'incredibly', 'absolutely']):
            intensity = "high"
        elif any(word in message_lower for word in ['a bit', 'somewhat', 'kind of', 'slightly', 'a little']):
            intensity = "low"
        
        # What type of conversation do they want?
        conversation_type = "general"
        if any(phrase in message_lower for phrase in ['what should i', 'help me', 'advice', 'what do you think']):
            conversation_type = "seeking_advice"
        elif any(phrase in message_lower for phrase in ['need to talk', 'vent', 'get this out', 'listen']):
            conversation_type = "emotional_support"
        elif any(phrase in message_lower for phrase in ['excited', 'guess what', 'great news', 'amazing']):
            conversation_type = "sharing_good_news"
        elif '?' in message:
            conversation_type = "asking_question"
        
        # What's happening in time?
        time_context = "general"
        if any(word in message_lower for word in ['today', 'right now', 'currently', 'just happened']):
            time_context = "present"
        elif any(word in message_lower for word in ['yesterday', 'last week', 'ago', 'before']):
            time_context = "past"
        elif any(word in message_lower for word in ['tomorrow', 'next week', 'will', 'going to']):
            time_context = "future"
        
        # Extract key phrases they mentioned
        key_phrases = []
        # Look for "my [something]" patterns
        my_matches = re.findall(r'my (\w+(?:\s+\w+)*)', message_lower)
        key_phrases.extend(my_matches[:2])
        
        # Look for "the [something]" patterns  
        the_matches = re.findall(r'the (\w+(?:\s+\w+)*)', message_lower)
        key_phrases.extend(the_matches[:1])
        
        return {
            'main_subject': main_subject,
            'emotions': emotions,
            'intensity': intensity,
            'conversation_type': conversation_type,
            'time_context': time_context,
            'key_phrases': key_phrases
        }
    
    def generate_contextual_response(self, message: str, analysis: Dict[str, Any]) -> str:
        """Generate a response that directly addresses what they said"""
        response_parts = []
        
        # 1. Acknowledge what they're talking about
        if analysis['key_phrases'] and analysis['emotions']:
            key_phrase = analysis['key_phrases'][0]
            emotion = analysis['emotions'][0]
            acknowledgment = f"{random.choice(self.acknowledgments)} you're feeling {emotion} about {key_phrase}."
            response_parts.append(acknowledgment)
        elif analysis['emotions']:
            emotion = analysis['emotions'][0]
            acknowledgment = f"{random.choice(self.acknowledgments)} you're feeling {emotion}."
            response_parts.append(acknowledgment)
        elif analysis['key_phrases']:
            key_phrase = analysis['key_phrases'][0]
            acknowledgment = f"{random.choice(self.acknowledgments)} {key_phrase} is really on your mind."
            response_parts.append(acknowledgment)
        
        # 2. Respond to their emotional state with appropriate intensity
        if analysis['emotions']:
            emotion = analysis['emotions'][0]
            intensity = analysis['intensity']
            
            empathy_responses = {
                'frustrated': {
                    'low': "That sounds mildly annoying.",
                    'medium': "That sounds really frustrating to deal with.",
                    'high': "That sounds absolutely infuriating. No wonder you're so upset."
                },
                'sad': {
                    'low': "That sounds like it's weighing on you a bit.",
                    'medium': "That sounds really hard to go through.",
                    'high': "That sounds heartbreaking. I can only imagine how difficult this must be."
                },
                'worried': {
                    'low': "That sounds like it's creating some concern for you.",
                    'medium': "That sounds really stressful and worrying.",
                    'high': "That sounds overwhelming and terrifying. That level of anxiety must be exhausting."
                },
                'happy': {
                    'low': "That sounds nice!",
                    'medium': "That sounds really wonderful!",
                    'high': "That sounds absolutely amazing! I can feel your excitement!"
                },
                'confused': {
                    'low': "That sounds a bit puzzling.",
                    'medium': "That sounds really confusing and unclear.",
                    'high': "That sounds completely bewildering. No wonder you're feeling lost."
                }
            }
            
            if emotion in empathy_responses and intensity in empathy_responses[emotion]:
                empathy = empathy_responses[emotion][intensity]
                response_parts.append(empathy)
        
        # 3. Address the specific type of conversation they want
        if analysis['conversation_type'] == 'seeking_advice':
            response_parts.append("I can tell you're looking for some guidance on this. What feels most important to you in this situation?")
        elif analysis['conversation_type'] == 'emotional_support':
            response_parts.append("It sounds like you really needed to get this out. I'm here to listen to whatever you need to share.")
        elif analysis['conversation_type'] == 'sharing_good_news':
            response_parts.append("I love that you wanted to share this exciting news with me! Tell me more about what makes this so special.")
        elif analysis['conversation_type'] == 'asking_question':
            response_parts.append("That's a really thoughtful question you're asking.")
        
        # 4. Add subject-specific insights
        subject_insights = {
            'work': "Work situations can be so complex, especially when they affect how we feel day to day.",
            'family': "Family dynamics can be some of the most complicated relationships we navigate.",
            'friendship': "Friendships mean so much to us, and when something's off it really affects us.",
            'relationship': "Relationships bring up such deep feelings. There's so much emotion involved.",
            'school': "School can be such a pressure cooker with all the expectations and deadlines."
        }
        
        if analysis['main_subject'] in subject_insights:
            response_parts.append(subject_insights[analysis['main_subject']])
        
        # 5. Add a relevant follow-up question
        follow_ups = {
            'work': "How is this affecting you outside of work?",
            'family': "How are you handling this family situation?",
            'friendship': "What's your friendship usually like with them?",
            'relationship': "How are you two doing with communication about this?",
            'school': "How are you managing the stress of everything?",
            'general': "What's going through your mind about all this?"
        }
        
        subject = analysis['main_subject'] if analysis['main_subject'] != 'general' else 'general'
        if analysis['conversation_type'] not in ['seeking_advice', 'asking_question']:  # Don't double up on questions
            response_parts.append(follow_ups[subject])
        
        # Combine into natural response
        if len(response_parts) == 1:
            return response_parts[0]
        elif len(response_parts) == 2:
            return f"{response_parts[0]} {response_parts[1]}"
        elif len(response_parts) >= 3:
            # Combine first two, then add the follow-up
            main_part = f"{response_parts[0]} {response_parts[1]}"
            follow_up = response_parts[-1]
            return f"{main_part} {follow_up}"
        else:
            return "I'm really listening to what you're sharing. Tell me more about what's on your mind."
    
    async def respond_to_message(self, message: str) -> Dict[str, Any]:
        """Main method to analyze and respond to user message"""
        await asyncio.sleep(random.uniform(0.3, 0.6))  # Thinking time
        
        # Analyze what they're actually saying
        analysis = self.analyze_message(message)
        
        # Generate contextual response
        response = self.generate_contextual_response(message, analysis)
        
        return {
            'response': response,
            'analysis': analysis,
            'response_type': 'contextual'
        }

# Initialize the contextual AI
contextual_ai = ContextualAI()

@app.get("/", response_class=HTMLResponse)
async def read_root():
    return HTMLResponse(content="""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎯 Contextual AI Companion</title>
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
        .analysis-panel {
            background-color: #222; padding: 12px; margin-top: 8px;
            border-radius: 6px; border: 1px solid #333;
            font-size: 12px;
        }
        .analysis-item {
            margin: 4px 0; display: flex; justify-content: space-between;
        }
        .analysis-label { color: #888; }
        .analysis-value { color: #10b981; font-weight: 500; }
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
        .contextual-badge {
            font-size: 10px; background-color: #10b981; color: #000;
            padding: 2px 6px; border-radius: 10px; font-weight: 600;
            margin-top: 4px; align-self: flex-start;
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
        .comparison {
            background-color: #1a1a2e; border: 1px solid #16213e;
            border-radius: 8px; padding: 16px; margin: 16px 0;
        }
        .comparison h3 { color: #4ade80; margin-bottom: 8px; }
        .comparison p { color: #d1d5db; font-size: 14px; line-height: 1.4; }
        .example { margin: 8px 0; padding: 8px; background-color: #374151; border-radius: 4px; }
        .example strong { color: #10b981; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 Contextual AI Companion</h1>
        <div class="status">Now responding directly to what you actually say!</div>
        <div class="analysis-panel" id="analysisPanel">
            <div class="analysis-item">
                <span class="analysis-label">Last Analysis:</span>
                <span class="analysis-value" id="lastAnalysis">Send a message to see analysis</span>
            </div>
        </div>
    </div>
    
    <div id="chatContainer" class="chat-container">
        <div class="comparison">
            <h3>🔄 How This New Version is Different:</h3>
            <div class="example">
                <strong>Old way:</strong> "I detect sadness → Generic sad response template"
            </div>
            <div class="example">
                <strong>New way:</strong> "You're feeling frustrated about your boss → That sounds really frustrating to deal with. Work situations can be so complex..."
            </div>
            <p>Try saying something specific like: "I'm really frustrated with my boss today" or "I'm excited about my new job" and watch how it responds directly to your content!</p>
        </div>
        
        <div class="message ai-message">
            <div class="message-content">
                Hi! I'm your contextual AI companion. I now analyze what you're actually saying and respond directly to the content, emotions, and context of your message. Instead of using templates, I build responses that address exactly what you're sharing with me. Try telling me about something specific that's on your mind!
            </div>
            <div class="contextual-badge">CONTEXTUAL RESPONSE</div>
            <div class="message-time">Now</div>
        </div>
    </div>
    
    <div class="input-container">
        <div class="input-wrapper">
            <textarea id="messageInput" placeholder="Tell me something specific that's on your mind..." rows="1"></textarea>
            <button id="sendBtn">Send</button>
        </div>
    </div>
    
    <script>
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const chatContainer = document.getElementById('chatContainer');
        const analysisPanel = document.getElementById('lastAnalysis');
        
        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
        
        function addMessage(content, isUser, analysis = null) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
            
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            let badge = '';
            if (!isUser) {
                badge = '<div class="contextual-badge">CONTEXTUAL RESPONSE</div>';
            }
            
            messageDiv.innerHTML = `
                <div class="message-content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                ${badge}
                <div class="message-time">${timeString}</div>
            `;
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            // Update analysis panel
            if (analysis && isUser) {
                updateAnalysisPanel(analysis);
            }
        }
        
        function updateAnalysisPanel(analysis) {
            const analysisText = `Subject: ${analysis.main_subject} | Emotions: ${analysis.emotions.join(', ') || 'none'} | Type: ${analysis.conversation_type} | Phrases: ${analysis.key_phrases.join(', ') || 'none'}`;
            analysisPanel.textContent = analysisText;
        }
        
        function showTyping() {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'message ai-message';
            typingDiv.id = 'typing';
            typingDiv.innerHTML = `
                <div class="message-content" style="color: #888; font-style: italic;">
                    Analyzing your message and crafting contextual response...
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
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: message })
                });
                
                const data = await response.json();
                hideTyping();
                addMessage(data.response, false, data.analysis);
                
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

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    try:
        body = await request.json()
        message = body.get('message', '')
        
        if not message:
            return JSONResponse({"error": "Message is required"}, status_code=400)
        
        # Generate contextual response
        result = await contextual_ai.respond_to_message(message)
        
        return JSONResponse({
            "response": result['response'],
            "analysis": result['analysis'],
            "response_type": result['response_type'],
            "timestamp": datetime.now().isoformat()
        })
    
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "message": "Contextual AI Companion is running",
        "version": "3.0.0",
        "features": [
            "Content-aware message analysis",
            "Contextual response generation", 
            "Direct subject addressing",
            "Emotional intensity matching",
            "Conversation type detection"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)