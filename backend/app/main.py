from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
import os
from pathlib import Path

from .models.database import create_tables, get_db
from .routers import chat

# Create FastAPI app with enhanced metadata
app = FastAPI(
    title="Enhanced AI Companion", 
    version="2.0.0",
    description="An intelligent AI companion with emotional awareness, learning capabilities, and conversation memory"
)

# Create database tables (this will create all new tables too)
create_tables()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

# Include enhanced chat router
app.include_router(chat.router, prefix="/api", tags=["chat"])

# Root endpoint - serve enhanced chat interface
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("chat.html", {"request": request})

# Health check endpoint with enhanced information
@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "message": "Enhanced AI Companion API is running",
        "version": "2.0.0",
        "features": [
            "Multi-emotion detection with intensity",
            "Advanced topic recognition",
            "User fact learning and memory",
            "Conversation summarization",
            "Personality-aware responses",
            "Real-time typing analysis"
        ]
    }

# New endpoint for system statistics
@app.get("/api/stats")
async def get_system_stats(db: Session = Depends(get_db)):
    """Get system-wide statistics"""
    from .models.database import User, Conversation, Message, UserFact
    
    try:
        total_users = db.query(User).count()
        total_conversations = db.query(Conversation).count()
        total_messages = db.query(Message).count()
        total_facts = db.query(UserFact).count()
        
        return {
            "total_users": total_users,
            "total_conversations": total_conversations,
            "total_messages": total_messages,
            "total_facts_learned": total_facts,
            "avg_messages_per_conversation": round(total_messages / max(total_conversations, 1), 2),
            "avg_facts_per_user": round(total_facts / max(total_users, 1), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)