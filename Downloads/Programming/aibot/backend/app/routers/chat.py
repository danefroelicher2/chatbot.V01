from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..models.database import get_db, User, Conversation, Message, UserFact
from ..services.ai_service import AIService

router = APIRouter()

# Pydantic models for request/response
class ChatMessage(BaseModel):
    content: str
    is_user: bool
    timestamp: datetime

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[int] = 1
    conversation_id: Optional[int] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: int
    message_id: int

class ConversationHistory(BaseModel):
    id: int
    title: str
    created_at: datetime
    last_message_at: datetime
    message_count: int

# Initialize AI service
ai_service = AIService()

@router.post("/chat", response_model=ChatResponse)
async def send_message(request: ChatRequest, db: Session = Depends(get_db)):
    """Send a message and get AI response"""
    
    # Get or create user
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        user = User(id=request.user_id, username=f"user_{request.user_id}")
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Get or create conversation
    if request.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id,
            Conversation.user_id == request.user_id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        # Create new conversation
        conversation = Conversation(
            user_id=request.user_id,
            title=request.message[:50] + "..." if len(request.message) > 50 else request.message
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        content=request.message,
        is_user=True
    )
    db.add(user_message)
    
    # Get conversation history for context
    recent_messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.timestamp.desc()).limit(10).all()
    
    # Get user facts for personalization
    user_facts = db.query(UserFact).filter(UserFact.user_id == request.user_id).all()
    
    # Generate AI response
    ai_response = await ai_service.generate_response(
        message=request.message,
        conversation_history=[{"content": msg.content, "is_user": msg.is_user} for msg in reversed(recent_messages)],
        user_facts={fact.key: fact.value for fact in user_facts}
    )
    
    # Save AI response
    ai_message = Message(
        conversation_id=conversation.id,
        content=ai_response,
        is_user=False
    )
    db.add(ai_message)
    
    # Update conversation last message time
    conversation.last_message_at = datetime.utcnow()
    
    db.commit()
    db.refresh(ai_message)
    
    return ChatResponse(
        response=ai_response,
        conversation_id=conversation.id,
        message_id=ai_message.id
    )

@router.get("/conversations", response_model=List[ConversationHistory])
async def get_conversations(user_id: int = 1, db: Session = Depends(get_db)):
    """Get user's conversation history"""
    
    conversations = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.is_active == True
    ).order_by(Conversation.last_message_at.desc()).all()
    
    result = []
    for conv in conversations:
        message_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
        result.append(ConversationHistory(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            last_message_at=conv.last_message_at,
            message_count=message_count
        ))
    
    return result

@router.get("/conversation/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    """Get messages from a specific conversation"""
    
    # Verify conversation belongs to user
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.timestamp.asc()).all()
    
    return [
        ChatMessage(
            content=msg.content,
            is_user=msg.is_user,
            timestamp=msg.timestamp
        )
        for msg in messages
    ]