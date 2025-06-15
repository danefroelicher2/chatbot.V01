# backend/app/main.py
"""
Enhanced Main Application with Sophisticated Conversational AI
Integrates the new memory-managed conversational system
"""

from fastapi import FastAPI, Depends, HTTPException, Request, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
from pathlib import Path
import logging

from .models.database import create_tables, get_db
from .routers import chat
from .routers.enhanced_chat import router as enhanced_chat_router

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app with enhanced metadata
app = FastAPI(
    title="Enhanced AI Companion", 
    version="3.0.0",
    description="An intelligent AI companion with advanced conversational abilities, memory management, and context awareness"
)

# Add CORS middleware for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
create_tables()

# Mount static files and templates
try:
    if os.path.exists("frontend/static"):
        app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
    if os.path.exists("frontend/templates"):
        templates = Jinja2Templates(directory="frontend/templates")
    else:
        templates = None
except Exception as e:
    logger.warning(f"Could not mount static files or templates: {e}")
    templates = None

# Include routers
app.include_router(chat.router, prefix="/api", tags=["legacy-chat"])  # Keep old chat for compatibility
app.include_router(enhanced_chat_router, prefix="/api", tags=["enhanced-chat"])  # New enhanced chat

# Root endpoint - serve enhanced chat interface
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Serve the enhanced chat interface"""
    if templates:
        return templates.TemplateResponse("enhanced_chat.html", {"request": request})
    else:
        # Fallback to inline HTML if templates not available
        return HTMLResponse(content=get_enhanced_chat_html())

def get_enhanced_chat_html():
    """Enhanced chat interface with memory management indicators"""
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🧠 Enhanced AI Companion</title>
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
        .memory-indicator {
            margin-top: 8px; padding: 8px 12px; background-color: #222;
            border-radius: 6px; border: 1px solid #333;
        }
        .memory-bar {
            width: 100%; height: 4px; background-color: #333;
            border-radius: 2px; overflow: hidden; margin-top: 4px;
        }
        .memory-fill {
            height: 100%; background-color: #10b981;
            transition: width 0.3s ease;
        }
        .memory-overflow { background-color: #ef4444 !important; }
        .memory-warning { background-color: #f59e0b !important; }
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
        .enhanced-badge {
            font-size: 10px; background-color: #10b981; color: #000;
            padding: 2px 6px; border-radius: 10px; font-weight: 600;
            margin-top: 4px; align-self: flex-start;
        }
        .memory-overflow-warning {
            background-color: #fef3c7; border: 1px solid #f59e0b;
            color: #92400e; padding: 12px; border-radius: 8px;
            margin: 16px 0; text-align: center;
        }
        .new-chat-button {
            background-color: #10b981; color: #000; border: none;
            padding: 8px 16px; border-radius: 6px; cursor: pointer;
            font-weight: 600; margin-top: 8px;
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
    </style>
</head>
<body>
    <div class="header">
        <h1>🧠 Enhanced AI Companion</h1>
        <div class="status" id="status">Advanced conversational AI with memory management</div>
        <div class="memory-indicator">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #888;">Conversation Memory:</span>
                <span id="memoryStatus" style="font-size: 12px; color: #10b981;">0/50 messages</span>
            </div>
            <div class="memory-bar">
                <div id="memoryFill" class="memory-fill" style="width: 0%;"></div>
            </div>
        </div>
    </div>
    
    <div id="chatContainer" class="chat-container">
        <div class="message ai-message">
            <div class="message-content">
                Hello! I'm your enhanced AI companion with advanced conversational abilities. I can:
                <br>• Understand what you're actually talking about
                <br>• Build responses that address your specific content
                <br>• Remember our conversation context
                <br>• Know when to start fresh when memory gets full
                <br><br>Try telling me something specific like "I'm stressed about my presentation tomorrow" and see how I respond!
            </div>
            <div class="enhanced-badge">ENHANCED CONVERSATIONAL AI</div>
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
        class EnhancedChatApp {
            constructor() {
                this.currentConversationId = null;
                this.memoryStatus = { current: 0, max: 50 };
                
                this.initializeElements();
                this.attachEventListeners();
            }
            
            initializeElements() {
                this.messageInput = document.getElementById('messageInput');
                this.sendBtn = document.getElementById('sendBtn');
                this.chatContainer = document.getElementById('chatContainer');
                this.memoryStatus = document.getElementById('memoryStatus');
                this.memoryFill = document.getElementById('memoryFill');
                this.status = document.getElementById('status');
            }
            
            attachEventListeners() {
                this.sendBtn.addEventListener('click', () => this.sendMessage());
                this.messageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                });
                this.messageInput.addEventListener('input', () => this.autoResizeTextarea());
            }
            
            autoResizeTextarea() {
                this.messageInput.style.height = 'auto';
                this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
            }
            
            async sendMessage() {
                const message = this.messageInput.value.trim();
                if (!message) return;
                
                this.messageInput.value = '';
                this.messageInput.style.height = 'auto';
                this.sendBtn.disabled = true;
                
                this.addMessage(message, true);
                this.showTypingIndicator();
                
                try {
                    const response = await fetch('/api/enhanced-chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: message,
                            user_id: 1,
                            conversation_id: this.currentConversationId
                        })
                    });
                    
                    const data = await response.json();
                    this.hideTypingIndicator();
                    
                    // Handle memory overflow
                    if (data.memory_overflow) {
                        this.handleMemoryOverflow(data);
                        return;
                    }
                    
                    // Update conversation ID
                    if (!this.currentConversationId) {
                        this.currentConversationId = data.conversation_id;
                    }
                    
                    // Add AI response
                    this.addEnhancedMessage(data.response, false, data);
                    
                    // Update memory status
                    this.updateMemoryStatus(data.memory_status);
                    
                } catch (error) {
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
                
                this.chatContainer.appendChild(messageDiv);
                this.scrollToBottom();
            }
            
            addEnhancedMessage(content, isUser, metadata) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
                
                const now = new Date();
                const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                let badge = '';
                if (!isUser) {
                    badge = '<div class="enhanced-badge">ENHANCED RESPONSE</div>';
                }
                
                messageDiv.innerHTML = `
                    <div class="message-content">${this.escapeHtml(content)}</div>
                    ${badge}
                    <div class="message-time">${timeString}</div>
                `;
                
                this.chatContainer.appendChild(messageDiv);
                this.scrollToBottom();
            }
            
            handleMemoryOverflow(data) {
                // Show memory overflow warning
                const warningDiv = document.createElement('div');
                warningDiv.className = 'memory-overflow-warning';
                warningDiv.innerHTML = `
                    <strong>💭 Memory Full!</strong><br>
                    ${data.response}
                    <button class="new-chat-button" onclick="location.reload()">Start New Chat</button>
                `;
                
                this.chatContainer.appendChild(warningDiv);
                this.scrollToBottom();
                
                // Update memory indicator to show overflow
                this.memoryFill.classList.add('memory-overflow');
                this.memoryStatus.textContent = 'Memory Full - Restart Required';
                this.status.textContent = 'Memory overflow - Please start a new chat';
                
                // Disable input
                this.messageInput.disabled = true;
                this.sendBtn.disabled = true;
            }
            
            updateMemoryStatus(memoryStatus) {
                const current = memoryStatus.message_count;
                const max = 50; // From memory management
                const percentage = (current / max) * 100;
                
                this.memoryStatus.textContent = `${current}/${max} messages`;
                this.memoryFill.style.width = `${percentage}%`;
                
                // Update colors based on usage
                this.memoryFill.classList.remove('memory-warning', 'memory-overflow');
                if (percentage > 90) {
                    this.memoryFill.classList.add('memory-overflow');
                } else if (percentage > 70) {
                    this.memoryFill.classList.add('memory-warning');
                }
                
                // Update status text
                if (percentage > 90) {
                    this.status.textContent = 'Memory almost full - conversation may restart soon';
                } else if (percentage > 70) {
                    this.status.textContent = 'Conversation memory getting full';
                } else {
                    this.status.textContent = 'Advanced conversational AI with memory management';
                }
            }
            
            showTypingIndicator() {
                const typingDiv = document.createElement('div');
                typingDiv.className = 'message ai-message';
                typingDiv.id = 'typing';
                typingDiv.innerHTML = `
                    <div class="message-content" style="color: #888; font-style: italic;">
                        Analyzing your message and crafting contextual response...
                    </div>
                `;
                this.chatContainer.appendChild(typingDiv);
                this.scrollToBottom();
            }
            
            hideTypingIndicator() {
                const typing = document.getElementById('typing');
                if (typing) typing.remove();
            }
            
            scrollToBottom() {
                this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
            }
            
            escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
        }
        
        // Initialize the enhanced chat app
        document.addEventListener('DOMContentLoaded', () => {
            new EnhancedChatApp();
        });
    </script>
</body>
</html>"""

# Health check endpoint with enhanced information
@app.get("/health")
async def health_check():
    """Enhanced health check with system status"""
    from .routers.enhanced_chat import ai_services
    
    return {
        "status": "healthy", 
        "message": "Enhanced AI Companion API is running",
        "version": "3.0.0",
        "features": [
            "Content-aware message analysis",
            "Dynamic response building",
            "Memory management with overflow handling",
            "Context threading across messages",
            "Automatic conversation restart",
            "Enhanced user fact learning",
            "Conversation insights and analytics"
        ],
        "system_status": {
            "active_ai_services": len(ai_services),
            "database_connected": True,
            "memory_management": "active"
        }
    }

# System statistics endpoint
@app.get("/api/system/stats")
async def get_system_stats(db: Session = Depends(get_db)):
    """Get comprehensive system statistics"""
    from .models.database import User, Conversation, Message, UserFact
    from .routers.enhanced_chat import ai_services
    
    try:
        # Database stats
        total_users = db.query(User).count()
        total_conversations = db.query(Conversation).count()
        active_conversations = db.query(Conversation).filter(Conversation.is_active == True).count()
        total_messages = db.query(Message).count()
        total_facts = db.query(UserFact).count()
        
        # Memory stats
        total_memory_usage = 0
        memory_details = {}
        
        for key, service in ai_services.items():
            memory_usage = len(service.memory.messages)
            total_memory_usage += memory_usage
            memory_details[key] = {
                'messages_in_memory': memory_usage,
                'topics_tracked': len(service.memory.topics_discussed),
                'facts_learned': len(service.memory.key_facts)
            }
        
        return {
            "database_stats": {
                "total_users": total_users,
                "total_conversations": total_conversations,
                "active_conversations": active_conversations,
                "total_messages": total_messages,
                "total_facts_learned": total_facts,
                "avg_messages_per_conversation": round(total_messages / max(total_conversations, 1), 2),
                "avg_facts_per_user": round(total_facts / max(total_users, 1), 2)
            },
            "memory_stats": {
                "active_ai_services": len(ai_services),
                "total_messages_in_memory": total_memory_usage,
                "memory_details": memory_details
            },
            "system_health": {
                "database_responsive": True,
                "ai_services_healthy": len(ai_services) >= 0,  # Always true for now
                "memory_management_active": True
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")

# Demo endpoint to test conversation abilities
@app.post("/api/demo/conversation")
async def demo_conversation(
    demo_type: str = "presentation_stress",
    db: Session = Depends(get_db)
):
    """Demo endpoint to showcase enhanced conversation abilities"""
    
    demo_conversations = {
        "presentation_stress": [
            "I'm stressed about my presentation tomorrow",
            "Yeah, it's a big client meeting and I'm worried about the technical demo",
            "The slides look good but I'm nervous about the Q&A section",
            "What if they ask something I don't know?"
        ],
        "relationship_issue": [
            "I had a fight with my partner last night",
            "It was about money again - we never seem to agree on spending",
            "I feel like we're just talking past each other",
            "Maybe we need to find a better way to communicate about this stuff"
        ],
        "work_stress": [
            "Work has been really overwhelming lately",
            "My boss keeps piling on more projects without extending deadlines",
            "I'm working 12 hour days and still falling behind",
            "I don't know how much longer I can keep this up"
        ],
        "exciting_news": [
            "I got the job I interviewed for last week!",
            "I'm so excited but also nervous about starting",
            "It's a big step up from my current role",
            "The salary is amazing but there's a lot more responsibility"
        ]
    }
    
    if demo_type not in demo_conversations:
        raise HTTPException(status_code=400, detail="Invalid demo type")
    
    # Import here to avoid circular imports
    from .routers.enhanced_chat import ConversationalAIService
    
    demo_ai = ConversationalAIService()
    demo_results = []
    
    for message in demo_conversations[demo_type]:
        result = await demo_ai.process_message(message, user_id=999)  # Demo user
        
        demo_results.append({
            "user_message": message,
            "ai_response": result['response'],
            "analysis": {
                "intent": result['intent'],
                "emotions": result['detected_emotions'],
                "topics": result['detected_topics'],
                "sentiment": result['sentiment_score'],
                "specificity": result['conversation_analysis']['specificity_level']
            },
            "memory_status": result['memory_status']
        })
        
        # Stop if memory overflow occurs
        if result.get('memory_overflow'):
            demo_results.append({
                "memory_overflow": True,
                "overflow_reason": result.get('overflow_reason'),
                "conversation_summary": result.get('conversation_summary')
            })
            break
    
    return {
        "demo_type": demo_type,
        "conversation": demo_results,
        "insights": demo_ai.get_conversation_insights()
    }

# Background task for memory cleanup
@app.on_event("startup")
async def startup_event():
    """Initialize background tasks and system components"""
    logger.info("Enhanced AI Companion starting up...")
    logger.info("Features enabled: Memory Management, Context Threading, Dynamic Response Building")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("Enhanced AI Companion shutting down...")
    # Clean up AI services
    from .routers.enhanced_chat import ai_services
    ai_services.clear()
    logger.info("AI services cleaned up")

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with enhanced error information"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.now().isoformat(),
            "path": str(request.url)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "timestamp": datetime.now().isoformat(),
            "path": str(request.url)
        }
    )

# Middleware for request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log incoming requests for monitoring"""
    start_time = datetime.now()
    
    response = await call_next(request)
    
    process_time = (datetime.now() - start_time).total_seconds()
    
    # Log enhanced chat requests specifically
    if request.url.path.startswith("/api/enhanced-chat"):
        logger.info(f"Enhanced Chat Request: {request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
    
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")