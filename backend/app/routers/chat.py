from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from ..models.database import (
    get_db, User, Conversation, Message, UserFact, ConversationTheme, 
    ResponseFeedback, ConversationSummary
)
from ..services.ai_service import EnhancedAIService

router = APIRouter()

# Pydantic models for request/response
class ChatMessage(BaseModel):
    content: str
    is_user: bool
    timestamp: datetime
    detected_emotions: Optional[List[Dict[str, Any]]] = []
    detected_topics: Optional[List[str]] = []
    sentiment_score: Optional[float] = 0.0

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[int] = 1
    conversation_id: Optional[int] = None

class EnhancedChatResponse(BaseModel):
    response: str
    conversation_id: int
    message_id: int
    detected_emotions: List[Dict[str, Any]]
    detected_topics: List[str]
    intent: str
    sentiment_score: float
    new_facts_learned: int
    conversation_summary: Optional[Dict[str, Any]] = None

class ConversationHistory(BaseModel):
    id: int
    title: str
    created_at: datetime
    last_message_at: datetime
    message_count: int
    dominant_emotion: Optional[str] = None
    themes: List[str] = []

class UserProfile(BaseModel):
    user_id: int
    name: Optional[str] = None
    facts_count: int
    conversations_count: int
    personality_traits: Dict[str, Any]
    recent_emotions: List[Dict[str, Any]]
    favorite_topics: List[str]

# Initialize enhanced AI service
ai_service = EnhancedAIService()

@router.post("/chat", response_model=EnhancedChatResponse)
async def send_message(request: ChatRequest, db: Session = Depends(get_db)):
    """Send a message and get enhanced AI response with full context analysis"""
    
    # Get or create user with personality profile
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
    
    # Get or create conversation
    if request.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id,
            Conversation.user_id == request.user_id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        # Create new conversation with better title generation
        title = generate_conversation_title(request.message)
        conversation = Conversation(
            user_id=request.user_id,
            title=title
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Get conversation history for context (last 20 messages)
    recent_messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.timestamp.desc()).limit(20).all()
    recent_messages.reverse()  # Chronological order
    
    # Get user facts for personalization
    user_facts = db.query(UserFact).filter(UserFact.user_id == request.user_id).all()
    user_facts_dict = {fact.key: fact.value for fact in user_facts}
    
    # Get conversation themes for context
    themes = db.query(ConversationTheme).filter(
        ConversationTheme.conversation_id == conversation.id
    ).all()
    theme_names = [theme.theme for theme in themes]
    
    # Prepare conversation history for AI
    conversation_history = []
    for msg in recent_messages:
        conversation_history.append({
            'content': msg.content,
            'is_user': msg.is_user,
            'timestamp': msg.timestamp,
            'detected_emotions': msg.detected_emotions or [],
            'detected_topics': msg.detected_topics or [],
            'sentiment_score': msg.sentiment_score or 0.0
        })
    
    # Build conversation context
    conversation_context = {
        'previous_themes': theme_names,
        'conversation_length': len(conversation_history),
        'user_profile': user.personality_profile,
        'recent_sentiment': calculate_recent_sentiment(conversation_history)
    }
    
    # Generate enhanced AI response
    ai_result = await ai_service.generate_response(
        message=request.message,
        conversation_history=conversation_history,
        user_facts=user_facts_dict,
        user_profile=user.personality_profile,
        conversation_context=conversation_context
    )
    
    # Save user message with analysis
    user_message = Message(
        conversation_id=conversation.id,
        content=request.message,
        is_user=True,
        detected_emotions=ai_result['detected_emotions'],
        detected_topics=ai_result['detected_topics'],
        sentiment_score=ai_result['sentiment_score'],
        intent=ai_result['intent']
    )
    db.add(user_message)
    
    # Save AI response
    ai_message = Message(
        conversation_id=conversation.id,
        content=ai_result['response'],
        is_user=False,
        detected_emotions=[],  # AI messages don't have emotions
        detected_topics=ai_result['detected_topics'],
        sentiment_score=0.0  # Neutral for AI
    )
    db.add(ai_message)
    
    # Save any new user facts discovered
    new_facts_count = 0
    for fact_data in ai_result['new_user_facts']:
        # Check if fact already exists
        existing_fact = db.query(UserFact).filter(
            UserFact.user_id == request.user_id,
            UserFact.key == fact_data['key']
        ).first()
        
        if existing_fact:
            # Update existing fact and increase confidence
            existing_fact.value = fact_data['value']
            existing_fact.confidence = min(existing_fact.confidence + 0.1, 1.0)
            existing_fact.times_confirmed += 1
            existing_fact.updated_at = datetime.utcnow()
        else:
            # Create new fact
            new_fact = UserFact(
                user_id=request.user_id,
                fact_type=fact_data['fact_type'],
                key=fact_data['key'],
                value=fact_data['value'],
                confidence=fact_data['confidence'],
                source_conversation_id=conversation.id
            )
            db.add(new_fact)
            new_facts_count += 1
    
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
                confidence=0.7
            )
            db.add(new_theme)
    
    # Track response effectiveness
    response_feedback = ResponseFeedback(
        message_id=ai_message.id,
        response_type=ai_result['intent'],
        response_template=ai_result['response_metadata']['template_type'],
        user_engagement_score=len(request.message) / 100.0,  # Basic engagement metric
        conversation_continued=True,
        user_sentiment_change=0.0  # Will be updated when user responds
    )
    db.add(response_feedback)
    
    # Update conversation metadata
    conversation.last_message_at = datetime.utcnow()
    
    # Generate conversation summary if this is a substantial conversation
    conversation_summary = None
    if len(conversation_history) > 0 and len(conversation_history) % 10 == 0:  # Every 10 messages
        summary_data = ai_service.generate_conversation_summary(
            conversation_history + [{'content': request.message, 'is_user': True}],
            [theme.theme for theme in themes]
        )
        
        # Save summary to database
        summary = ConversationSummary(
            conversation_id=conversation.id,
            summary_type='periodic',
            key_points=summary_data.get('main_topics', {}),
            emotional_journey=summary_data.get('emotional_journey', []),
            topics_covered=summary_data.get('main_topics', {}),
            user_revelations=[fact_data for fact_data in ai_result['new_user_facts']]
        )
        db.add(summary)
        conversation_summary = summary_data
    
    # Update conversation's dominant emotion
    if ai_result['detected_emotions']:
        conversation.dominant_emotion = ai_result['detected_emotions'][0]['emotion']
    
    db.commit()
    db.refresh(ai_message)
    
    return EnhancedChatResponse(
        response=ai_result['response'],
        conversation_id=conversation.id,
        message_id=ai_message.id,
        detected_emotions=ai_result['detected_emotions'],
        detected_topics=ai_result['detected_topics'],
        intent=ai_result['intent'],
        sentiment_score=ai_result['sentiment_score'],
        new_facts_learned=new_facts_count,
        conversation_summary=conversation_summary
    )

@router.get("/conversations", response_model=List[ConversationHistory])
async def get_conversations(user_id: int = 1, db: Session = Depends(get_db)):
    """Get user's conversation history with enhanced metadata"""
    
    conversations = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.is_active == True
    ).order_by(Conversation.last_message_at.desc()).all()
    
    result = []
    for conv in conversations:
        message_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
        
        # Get themes for this conversation
        themes = db.query(ConversationTheme).filter(
            ConversationTheme.conversation_id == conv.id
        ).all()
        theme_names = [theme.theme for theme in themes]
        
        result.append(ConversationHistory(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            last_message_at=conv.last_message_at,
            message_count=message_count,
            dominant_emotion=conv.dominant_emotion,
            themes=theme_names
        ))
    
    return result

@router.get("/conversation/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    """Get messages from a specific conversation with enhanced metadata"""
    
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
            timestamp=msg.timestamp,
            detected_emotions=msg.detected_emotions or [],
            detected_topics=msg.detected_topics or [],
            sentiment_score=msg.sentiment_score or 0.0
        )
        for msg in messages
    ]

@router.get("/user/{user_id}/profile", response_model=UserProfile)
async def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    """Get comprehensive user profile with learned facts and patterns"""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user facts
    facts = db.query(UserFact).filter(UserFact.user_id == user_id).all()
    
    # Get conversation count
    conversations_count = db.query(Conversation).filter(Conversation.user_id == user_id).count()
    
    # Get recent emotions (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_messages = db.query(Message).filter(
        Message.conversation_id.in_(
            db.query(Conversation.id).filter(Conversation.user_id == user_id)
        ),
        Message.is_user == True,
        Message.timestamp >= thirty_days_ago
    ).all()
    
    # Aggregate emotions
    emotion_counts = {}
    for msg in recent_messages:
        if msg.detected_emotions:
            for emotion_data in msg.detected_emotions:
                emotion = emotion_data.get('emotion')
                if emotion:
                    if emotion not in emotion_counts:
                        emotion_counts[emotion] = {'count': 0, 'intensities': []}
                    emotion_counts[emotion]['count'] += 1
                    emotion_counts[emotion]['intensities'].append(emotion_data.get('intensity', 'medium'))
    
    recent_emotions = [
        {
            'emotion': emotion,
            'frequency': data['count'],
            'avg_intensity': max(set(data['intensities']), key=data['intensities'].count)
        }
        for emotion, data in sorted(emotion_counts.items(), key=lambda x: x[1]['count'], reverse=True)
    ]
    
    # Get favorite topics
    topic_counts = {}
    for msg in recent_messages:
        if msg.detected_topics:
            for topic in msg.detected_topics:
                topic_counts[topic] = topic_counts.get(topic, 0) + 1
    
    favorite_topics = [topic for topic, count in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)]
    
    # Extract name from facts
    name = None
    for fact in facts:
        if fact.key == 'name':
            name = fact.value
            break
    
    return UserProfile(
        user_id=user_id,
        name=name,
        facts_count=len(facts),
        conversations_count=conversations_count,
        personality_traits=user.personality_profile or {},
        recent_emotions=recent_emotions[:5],  # Top 5 emotions
        favorite_topics=favorite_topics[:5]   # Top 5 topics
    )

@router.get("/user/{user_id}/facts")
async def get_user_facts(user_id: int, db: Session = Depends(get_db)):
    """Get all learned facts about a user"""
    
    facts = db.query(UserFact).filter(UserFact.user_id == user_id).order_by(
        UserFact.confidence.desc(), 
        UserFact.updated_at.desc()
    ).all()
    
    return [
        {
            'id': fact.id,
            'type': fact.fact_type,
            'key': fact.key,
            'value': fact.value,
            'confidence': fact.confidence,
            'times_confirmed': fact.times_confirmed,
            'created_at': fact.created_at,
            'updated_at': fact.updated_at
        }
        for fact in facts
    ]

# Helper functions
def generate_conversation_title(first_message: str) -> str:
    """Generate a more intelligent conversation title"""
    message_lower = first_message.lower()
    
    # Topic-based titles
    if any(word in message_lower for word in ['work', 'job', 'career']):
        return "Work Discussion"
    elif any(word in message_lower for word in ['family', 'parents', 'mom', 'dad']):
        return "Family Matters"
    elif any(word in message_lower for word in ['relationship', 'partner', 'dating']):
        return "Relationship Talk"
    elif any(word in message_lower for word in ['goal', 'dream', 'future', 'plan']):
        return "Goals & Dreams"
    elif any(word in message_lower for word in ['sad', 'upset', 'frustrated', 'angry']):
        return "Emotional Support"
    elif any(word in message_lower for word in ['happy', 'excited', 'great', 'awesome']):
        return "Positive Vibes"
    else:
        # Fallback to first few words
        words = first_message.split()[:4]
        return ' '.join(words).title() + ("..." if len(first_message.split()) > 4 else "")

def calculate_recent_sentiment(conversation_history: List[Dict]) -> float:
    """Calculate average sentiment from recent messages"""
    if not conversation_history:
        return 0.0
    
    recent_messages = conversation_history[-5:]  # Last 5 messages
    user_messages = [msg for msg in recent_messages if msg.get('is_user', True)]
    
    if not user_messages:
        return 0.0
    
    total_sentiment = sum(msg.get('sentiment_score', 0.0) for msg in user_messages)
    return total_sentiment / len(user_messages)