# backend/app/routers/enhanced_chat.py
"""
Enhanced Chat Router that integrates with the new ConversationalAIService
Includes memory management and automatic new chat creation
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from ..models.database import (
    get_db, User, Conversation, Message, UserFact, ConversationTheme, 
    ResponseFeedback, ConversationSummary
)
from ..services.enhanced_conversational_ai import ConversationalAIService

router = APIRouter()

# Pydantic models
class EnhancedChatRequest(BaseModel):
    message: str
    user_id: Optional[int] = 1
    conversation_id: Optional[int] = None
    force_new_chat: Optional[bool] = False

class EnhancedChatResponse(BaseModel):
    response: str
    conversation_id: int
    message_id: int
    detected_emotions: List[Dict[str, Any]]
    detected_topics: List[str]
    intent: str
    sentiment_score: float
    new_facts_learned: int
    memory_status: Dict[str, Any]
    conversation_analysis: Dict[str, Any]
    memory_overflow: Optional[bool] = False
    restart_required: Optional[bool] = False
    conversation_summary: Optional[Dict[str, Any]] = None

# Global AI service instances (in production, use dependency injection)
ai_services: Dict[str, ConversationalAIService] = {}

def get_ai_service(conversation_id: Optional[int] = None) -> ConversationalAIService:
    """Get or create AI service for conversation"""
    key = f"conv_{conversation_id}" if conversation_id else "new"
    
    if key not in ai_services:
        ai_services[key] = ConversationalAIService()
    
    return ai_services[key]

@router.post("/enhanced-chat", response_model=EnhancedChatResponse)
async def enhanced_chat(
    request: EnhancedChatRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Enhanced chat endpoint with sophisticated conversation management
    
    Key Improvements:
    1. Content-aware message analysis
    2. Dynamic response building 
    3. Memory management with overflow handling
    4. Context threading across messages
    5. Automatic new chat creation when needed
    """
    
    # Get or create user
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        user = User(
            id=request.user_id,
            username=f"user_{request.user_id}",
            personality_profile={
                'communication_style': 'adaptive',
                'preferred_response_length': 'medium',
                'emotional_support_level': 'high'
            }
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Handle conversation logic
    conversation = None
    ai_service = None
    
    if request.force_new_chat or not request.conversation_id:
        # Create new conversation
        conversation = await create_new_conversation(request, user, db)
        ai_service = ConversationalAIService()  # Fresh AI service
        ai_services[f"conv_{conversation.id}"] = ai_service
    else:
        # Use existing conversation
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id,
            Conversation.user_id == request.user_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Get existing AI service or create new one
        ai_service = get_ai_service(conversation.id)
        
        # Load conversation history into AI service if it's a fresh service
        if len(ai_service.memory.messages) == 0:
            await load_conversation_history(conversation.id, ai_service, db)
    
    # Process message with enhanced AI
    try:
        ai_result = await ai_service.process_message(
            message=request.message,
            user_id=request.user_id,
            conversation_id=conversation.id
        )
        
        # Handle memory overflow
        if ai_result.get('memory_overflow'):
            return await handle_memory_overflow(
                ai_result, conversation, user, db, background_tasks
            )
        
        # Save messages to database
        user_message, ai_message = await save_messages_to_db(
            conversation.id, request.message, ai_result, db
        )
        
        # Save discovered user facts
        new_facts_count = await save_user_facts(
            request.user_id, ai_result['new_user_facts'], conversation.id, db
        )
        
        # Update conversation metadata
        await update_conversation_metadata(
            conversation, ai_result, db
        )
        
        # Track response effectiveness
        await track_response_effectiveness(
            ai_message.id, ai_result, request.message, db
        )
        
        db.commit()
        
        return EnhancedChatResponse(
            response=ai_result['response'],
            conversation_id=conversation.id,
            message_id=ai_message.id,
            detected_emotions=ai_result['detected_emotions'],
            detected_topics=ai_result['detected_topics'],
            intent=ai_result['intent'],
            sentiment_score=ai_result['sentiment_score'],
            new_facts_learned=new_facts_count,
            memory_status=ai_result['memory_status'],
            conversation_analysis=ai_result['conversation_analysis'],
            memory_overflow=False,
            restart_required=False
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

async def create_new_conversation(
    request: EnhancedChatRequest, 
    user: User, 
    db: Session
) -> Conversation:
    """Create a new conversation with intelligent title generation"""
    
    # Generate intelligent title based on first message
    title = generate_intelligent_title(request.message)
    
    conversation = Conversation(
        user_id=user.id,
        title=title,
        summary="",  # Will be populated as conversation develops
        dominant_emotion=None  # Will be detected from first message
    )
    
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    
    return conversation

def generate_intelligent_title(message: str) -> str:
    """Generate intelligent conversation titles based on content analysis"""
    message_lower = message.lower()
    
    # Specific event-based titles
    if 'presentation' in message_lower:
        return "🎯 Presentation Discussion"
    elif any(word in message_lower for word in ['interview', 'job interview']):
        return "💼 Job Interview Talk"
    elif any(word in message_lower for word in ['meeting', 'work meeting']):
        return "🤝 Work Meeting Discussion" 
    elif any(word in message_lower for word in ['relationship', 'partner', 'boyfriend', 'girlfriend']):
        return "💕 Relationship Conversation"
    elif any(word in message_lower for word in ['family', 'parents', 'mom', 'dad']):
        return "👨‍👩‍👧‍👦 Family Discussion"
    elif any(word in message_lower for word in ['stressed', 'anxiety', 'worried', 'overwhelmed']):
        return "🧘‍♀️ Emotional Support"
    elif any(word in message_lower for word in ['excited', 'happy', 'great news', 'amazing']):
        return "🌟 Positive Vibes"
    elif any(word in message_lower for word in ['goal', 'dream', 'future', 'plan']):
        return "🎯 Goals & Dreams"
    elif any(word in message_lower for word in ['work', 'job', 'career']):
        return "💼 Work Discussion"
    elif any(word in message_lower for word in ['health', 'doctor', 'medical']):
        return "🏥 Health Matters"
    else:
        # Fallback to first few meaningful words
        words = [w for w in message.split()[:4] if len(w) > 3]
        if words:
            return f"💬 {' '.join(words).title()}"
        else:
            return f"💭 Chat {datetime.now().strftime('%m/%d %H:%M')}"

async def load_conversation_history(
    conversation_id: int, 
    ai_service: ConversationalAIService, 
    db: Session
):
    """Load existing conversation history into AI service memory"""
    
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.timestamp.asc()).all()
    
    for msg in messages:
        message_data = {
            'content': msg.content,
            'is_user': msg.is_user,
            'timestamp': msg.timestamp,
            'detected_emotions': msg.detected_emotions or [],
            'detected_topics': msg.detected_topics or []
        }
        ai_service.memory.add_message(message_data)

async def handle_memory_overflow(
    ai_result: Dict[str, Any],
    current_conversation: Conversation,
    user: User,
    db: Session,
    background_tasks: BackgroundTasks
) -> EnhancedChatResponse:
    """Handle memory overflow by creating conversation summary and suggesting new chat"""
    
    # Mark current conversation as completed
    current_conversation.is_active = False
    current_conversation.summary = generate_conversation_summary(ai_result.get('conversation_summary', {}))
    
    # Create conversation summary record
    summary = ConversationSummary(
        conversation_id=current_conversation.id,
        summary_type='memory_overflow',
        key_points=ai_result.get('conversation_summary', {}).get('main_topics', {}),
        emotional_journey=ai_result.get('conversation_summary', {}).get('emotional_journey', []),
        topics_covered=ai_result.get('conversation_summary', {}).get('main_topics', {}),
        user_revelations=[]
    )
    db.add(summary)
    
    # Clean up AI service for this conversation
    conv_key = f"conv_{current_conversation.id}"
    if conv_key in ai_services:
        del ai_services[conv_key]
    
    db.commit()
    
    return EnhancedChatResponse(
        response=ai_result['response'],
        conversation_id=current_conversation.id,
        message_id=0,  # No message saved due to overflow
        detected_emotions=[],
        detected_topics=[],
        intent='memory_overflow',
        sentiment_score=0.0,
        new_facts_learned=0,
        memory_status=ai_result['memory_status'],
        conversation_analysis={},
        memory_overflow=True,
        restart_required=True,
        conversation_summary=ai_result.get('conversation_summary')
    )

def generate_conversation_summary(summary_data: Dict[str, Any]) -> str:
    """Generate human-readable conversation summary"""
    if not summary_data:
        return "Rich conversation with multiple topics discussed."
    
    main_topics = summary_data.get('main_topics', {})
    message_count = summary_data.get('message_count', 0)
    
    if main_topics:
        top_topics = list(main_topics.keys())[:3]
        topics_text = ", ".join(top_topics)
        return f"Conversation with {message_count} messages covering: {topics_text}"
    else:
        return f"Meaningful conversation with {message_count} exchanges"

async def save_messages_to_db(
    conversation_id: int,
    user_message_content: str,
    ai_result: Dict[str, Any],
    db: Session
) -> tuple[Message, Message]:
    """Save user and AI messages to database"""
    
    # Save user message
    user_message = Message(
        conversation_id=conversation_id,
        content=user_message_content,
        is_user=True,
        detected_emotions=ai_result['detected_emotions'],
        detected_topics=ai_result['detected_topics'],
        sentiment_score=ai_result['sentiment_score'],
        intent=ai_result['intent']
    )
    db.add(user_message)
    
    # Save AI response
    ai_message = Message(
        conversation_id=conversation_id,
        content=ai_result['response'],
        is_user=False,
        detected_emotions=[],
        detected_topics=ai_result['detected_topics'],
        sentiment_score=0.0,
        intent='response'
    )
    db.add(ai_message)
    
    db.flush()  # Get IDs without committing
    
    return user_message, ai_message

async def save_user_facts(
    user_id: int,
    new_facts: List[Dict[str, Any]],
    conversation_id: int,
    db: Session
) -> int:
    """Save newly discovered user facts"""
    
    saved_count = 0
    
    for fact_data in new_facts:
        # Check if fact already exists
        existing_fact = db.query(UserFact).filter(
            UserFact.user_id == user_id,
            UserFact.key == fact_data['key']
        ).first()
        
        if existing_fact:
            # Update existing fact
            existing_fact.value = fact_data['value']
            existing_fact.confidence = min(existing_fact.confidence + 0.1, 1.0)
            existing_fact.times_confirmed += 1
            existing_fact.updated_at = datetime.utcnow()
        else:
            # Create new fact
            new_fact = UserFact(
                user_id=user_id,
                fact_type=fact_data['fact_type'],
                key=fact_data['key'],
                value=fact_data['value'],
                confidence=fact_data['confidence'],
                source_conversation_id=conversation_id
            )
            db.add(new_fact)
            saved_count += 1
    
    return saved_count

async def update_conversation_metadata(
    conversation: Conversation,
    ai_result: Dict[str, Any],
    db: Session
):
    """Update conversation with new metadata"""
    
    # Update last message time
    conversation.last_message_at = datetime.utcnow()
    
    # Update dominant emotion if detected
    if ai_result['detected_emotions']:
        conversation.dominant_emotion = ai_result['detected_emotions'][0]['emotion']
    
    # Update or create conversation themes
    for topic in ai_result['detected_topics']:
        existing_theme = db.query(ConversationTheme).filter(
            ConversationTheme.conversation_id == conversation.id,
            ConversationTheme.theme == topic
        ).first()
        
        if existing_theme:
            existing_theme.last_mentioned = datetime.utcnow()
            existing_theme.confidence = min(existing_theme.confidence + 0.1, 1.0)
        else:
            new_theme = ConversationTheme(
                conversation_id=conversation.id,
                theme=topic,
                confidence=0.8
            )
            db.add(new_theme)

async def track_response_effectiveness(
    message_id: int,
    ai_result: Dict[str, Any],
    user_message: str,
    db: Session
):
    """Track how effective our enhanced responses are"""
    
    response_feedback = ResponseFeedback(
        message_id=message_id,
        response_type=ai_result['intent'],
        response_template='enhanced_conversational',
        user_engagement_score=len(user_message) / 100.0,  # Basic engagement metric
        conversation_continued=True,
        user_sentiment_change=0.0  # Will be updated when user responds
    )
    db.add(response_feedback)

@router.get("/conversation/{conversation_id}/insights")
async def get_conversation_insights(
    conversation_id: int,
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    """Get detailed insights about a specific conversation"""
    
    # Verify conversation belongs to user
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get AI service for this conversation
    ai_service = get_ai_service(conversation_id)
    
    # If AI service is empty, load conversation history
    if len(ai_service.memory.messages) == 0:
        await load_conversation_history(conversation_id, ai_service, db)
    
    # Get insights from AI service
    insights = ai_service.get_conversation_insights()
    
    return {
        'conversation_id': conversation_id,
        'insights': insights,
        'database_stats': await get_conversation_database_stats(conversation_id, db)
    }

async def get_conversation_database_stats(conversation_id: int, db: Session) -> Dict[str, Any]:
    """Get database statistics for the conversation"""
    
    message_count = db.query(Message).filter(Message.conversation_id == conversation_id).count()
    user_message_count = db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.is_user == True
    ).count()
    
    themes = db.query(ConversationTheme).filter(
        ConversationTheme.conversation_id == conversation_id
    ).all()
    
    return {
        'total_messages': message_count,
        'user_messages': user_message_count,
        'ai_responses': message_count - user_message_count,
        'themes_tracked': len(themes),
        'theme_details': [
            {
                'theme': theme.theme,
                'confidence': theme.confidence,
                'first_mentioned': theme.first_mentioned,
                'last_mentioned': theme.last_mentioned
            }
            for theme in themes
        ]
    }

@router.post("/conversation/{conversation_id}/restart")
async def restart_conversation(
    conversation_id: int,
    user_id: int = 1,
    preserve_facts: bool = True,
    db: Session = Depends(get_db)
):
    """Manually restart a conversation (useful for testing memory overflow)"""
    
    # Verify conversation belongs to user
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get AI service
    ai_service = get_ai_service(conversation_id)
    
    # Reset the AI service memory
    reset_result = ai_service.reset_conversation(preserve_user_facts=preserve_facts)
    
    # Mark conversation as completed in database
    conversation.is_active = False
    conversation.summary = f"Manually restarted conversation with {len(reset_result['previous_conversation_summary']['recent_context'])} messages"
    
    db.commit()
    
    return {
        'restart_successful': True,
        'previous_conversation_summary': reset_result['previous_conversation_summary'],
        'preserved_facts': reset_result['preserved_facts'],
        'message': "Conversation memory has been reset. Start a new conversation to continue."
    }

@router.get("/conversations/active")
async def get_active_conversations(
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    """Get all active conversations with enhanced metadata"""
    
    conversations = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.is_active == True
    ).order_by(Conversation.last_message_at.desc()).all()
    
    result = []
    for conv in conversations:
        # Get message count
        message_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
        
        # Get themes
        themes = db.query(ConversationTheme).filter(
            ConversationTheme.conversation_id == conv.id
        ).all()
        
        # Get memory status if AI service exists
        memory_status = None
        conv_key = f"conv_{conv.id}"
        if conv_key in ai_services:
            ai_service = ai_services[conv_key]
            memory_status = {
                'messages_in_memory': len(ai_service.memory.messages),
                'topics_tracked': len(ai_service.memory.topics_discussed),
                'key_facts': len(ai_service.memory.key_facts),
                'memory_usage_percent': (len(ai_service.memory.messages) / ai_service.memory.max_messages) * 100
            }
        
        result.append({
            'id': conv.id,
            'title': conv.title,
            'created_at': conv.created_at,
            'last_message_at': conv.last_message_at,
            'message_count': message_count,
            'dominant_emotion': conv.dominant_emotion,
            'themes': [theme.theme for theme in themes],
            'memory_status': memory_status
        })
    
    return result

@router.delete("/conversation/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    """Delete a conversation and clean up AI service"""
    
    # Verify conversation belongs to user
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Clean up AI service
    conv_key = f"conv_{conversation_id}"
    if conv_key in ai_services:
        del ai_services[conv_key]
    
    # Mark as inactive instead of deleting (preserve data)
    conversation.is_active = False
    db.commit()
    
    return {"message": "Conversation deleted successfully"}

@router.get("/memory/status")
async def get_memory_status():
    """Get overall memory status of all active AI services"""
    
    status = {
        'active_services': len(ai_services),
        'services': {}
    }
    
    for key, service in ai_services.items():
        status['services'][key] = {
            'messages_in_memory': len(service.memory.messages),
            'max_messages': service.memory.max_messages,
            'memory_usage_percent': (len(service.memory.messages) / service.memory.max_messages) * 100,
            'topics_tracked': len(service.memory.topics_discussed),
            'key_facts_learned': len(service.memory.key_facts),
            'emotional_journey_length': len(service.memory.emotional_journey)
        }
    
    return status

@router.post("/memory/cleanup")
async def cleanup_memory():
    """Clean up inactive AI services (admin endpoint)"""
    
    cleaned_count = 0
    keys_to_remove = []
    
    for key, service in ai_services.items():
        # Remove services that haven't been used recently
        if len(service.memory.messages) > 0:
            last_message = service.memory.messages[-1]
            if isinstance(last_message.get('timestamp'), datetime):
                time_since_last = datetime.now() - last_message['timestamp']
                if time_since_last > timedelta(hours=1):  # 1 hour threshold
                    keys_to_remove.append(key)
    
    for key in keys_to_remove:
        del ai_services[key]
        cleaned_count += 1
    
    return {
        'cleaned_services': cleaned_count,
        'remaining_services': len(ai_services),
        'message': f"Cleaned up {cleaned_count} inactive AI services"
    }