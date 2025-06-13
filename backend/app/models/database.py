from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_companion.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# User model
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    personality_profile = Column(JSON, default=dict)  # Store user's communication style, preferences
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    conversations = relationship("Conversation", back_populates="user")
    user_facts = relationship("UserFact", back_populates="user")
    preferences = relationship("UserPreference", back_populates="user")

# Conversation model
class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200))
    summary = Column(Text)  # Key points from conversation
    dominant_emotion = Column(String(50))  # Primary emotion throughout conversation
    created_at = Column(DateTime, default=datetime.utcnow)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")
    themes = relationship("ConversationTheme", back_populates="conversation")

# Message model
class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    content = Column(Text, nullable=False)
    is_user = Column(Boolean, nullable=False)
    detected_emotions = Column(JSON, default=list)  # Multiple emotions with intensity
    detected_topics = Column(JSON, default=list)
    sentiment_score = Column(Float, default=0.0)  # -1 to 1
    intent = Column(String(50))  # 'advice_seeking', 'venting', 'sharing_news', etc.
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    response_feedback = relationship("ResponseFeedback", back_populates="message")

# User facts model (enhanced)
class UserFact(Base):
    __tablename__ = "user_facts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    fact_type = Column(String(50))  # 'preference', 'personal_info', 'interest', etc.
    key = Column(String(100))
    value = Column(Text)
    confidence = Column(Float, default=1.0)  # 0.0 to 1.0
    source_conversation_id = Column(Integer, ForeignKey("conversations.id"))
    times_confirmed = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="user_facts")

# User preferences model
class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    preference_key = Column(String(100))
    preference_value = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="preferences")

# NEW: Conversation themes tracking
class ConversationTheme(Base):
    __tablename__ = "conversation_themes"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    theme = Column(String(100))  # "work_stress", "family_planning", "relationship_issues"
    confidence = Column(Float, default=1.0)
    first_mentioned = Column(DateTime, default=datetime.utcnow)
    last_mentioned = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="themes")

# NEW: Response effectiveness tracking
class ResponseFeedback(Base):
    __tablename__ = "response_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"))
    response_type = Column(String(50))  # "emotional_support", "question", "advice", etc.
    response_template = Column(String(100))  # Which template was used
    user_engagement_score = Column(Float)  # Based on next message length, time to respond
    conversation_continued = Column(Boolean, default=True)
    user_sentiment_change = Column(Float)  # Did user mood improve after this response?
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    message = relationship("Message", back_populates="response_feedback")

# NEW: Conversation summaries for memory
class ConversationSummary(Base):
    __tablename__ = "conversation_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    summary_type = Column(String(50))  # "daily", "weekly", "topic_based"
    key_points = Column(JSON)  # List of important points discussed
    emotional_journey = Column(JSON)  # How emotions changed during conversation
    topics_covered = Column(JSON)  # Main topics and subtopics
    user_revelations = Column(JSON)  # New things learned about user
    created_at = Column(DateTime, default=datetime.utcnow)

# Create all tables
def create_tables():
    Base.metadata.create_all(bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()