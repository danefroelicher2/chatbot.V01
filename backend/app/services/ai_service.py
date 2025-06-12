import asyncio
import random
import re
from typing import List, Dict, Any, Optional
from datetime import datetime

class AIService:
    """Enhanced AI service with rich response patterns and context awareness"""
    
    def __init__(self):
        # Greeting responses
        self.greetings = [
            "Hello! It's wonderful to see you again. How has your day been treating you?",
            "Hi there! I'm so glad you're here. What's on your mind today?",
            "Hey! Great to chat with you. What would you like to talk about?",
            "Hello! I've been looking forward to our conversation. How are you feeling?",
            "Hi! It's always a pleasure to hear from you. What's new in your world?"
        ]
        
        # Question responses by type
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
        
        # Emotional responses
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
            ]
        }
        
        # Topic-based responses
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
            ]
        }
        
        # Conversation starters and follow-ups
        self.conversation_starters = [
            "I'm curious - what's been the most interesting part of your day so far?",
            "Is there something you've been thinking about lately that you'd like to explore together?",
            "What's something that's been bringing you joy recently?",
            "I'd love to hear about something you're looking forward to.",
            "What's been on your mind that you haven't had a chance to talk about with anyone?"
        ]
        
        # Thoughtful generic responses
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
        
        # Keywords for topic detection
        self.topic_keywords = {
            'work': ['job', 'work', 'career', 'boss', 'colleague', 'office', 'meeting', 'project', 'deadline'],
            'family': ['family', 'mom', 'dad', 'parent', 'sibling', 'brother', 'sister', 'child', 'kids'],
            'relationship': ['relationship', 'partner', 'dating', 'boyfriend', 'girlfriend', 'marriage', 'love'],
            'health': ['health', 'doctor', 'sick', 'exercise', 'diet', 'sleep', 'tired', 'energy'],
            'goals': ['goal', 'dream', 'ambition', 'future', 'plan', 'hope', 'want', 'wish', 'achieve'],
            'hobbies': ['hobby', 'interest', 'passion', 'enjoy', 'fun', 'game', 'sport', 'music', 'art', 'read']
        }
        
        # Emotion keywords
        self.emotion_keywords = {
            'sad': ['sad', 'upset', 'down', 'depressed', 'blue', 'disappointed', 'hurt', 'crying'],
            'happy': ['happy', 'joy', 'excited', 'great', 'awesome', 'wonderful', 'amazing', 'fantastic', 'good'],
            'frustrated': ['frustrated', 'annoyed', 'angry', 'mad', 'irritated', 'stressed'],
            'worried': ['worried', 'anxious', 'nervous', 'concerned', 'scared', 'afraid'],
            'excited': ['excited', 'thrilled', 'pumped', 'enthusiastic', 'eager', 'looking forward']
        }
    
    def detect_topics(self, message: str) -> List[str]:
        """Detect topics in the message"""
        message_lower = message.lower()
        detected_topics = []
        
        for topic, keywords in self.topic_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                detected_topics.append(topic)
        
        return detected_topics
    
    def detect_emotions(self, message: str) -> List[str]:
        """Detect emotions in the message"""
        message_lower = message.lower()
        detected_emotions = []
        
        for emotion, keywords in self.emotion_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                detected_emotions.append(emotion)
        
        return detected_emotions
    
    def detect_question_type(self, message: str) -> Optional[str]:
        """Detect the type of question being asked"""
        message_lower = message.lower()
        
        question_words = ['how', 'why', 'what', 'when', 'where', 'who', 'which']
        for word in question_words:
            if word in message_lower:
                return word
        
        if message.strip().endswith('?'):
            return 'general'
        
        return None
    
    def build_personalized_response(self, base_response: str, user_facts: Dict[str, str]) -> str:
        """Add personalization to responses based on user facts"""
        if not user_facts:
            return base_response
        
        # Add relevant personal context
        personal_additions = []
        
        if 'name' in user_facts:
            personal_additions.append(f"I know this is important to you, {user_facts['name']}")
        
        if 'interests' in user_facts:
            personal_additions.append(f"Given your interest in {user_facts['interests']}, I think you might find this particularly relevant")
        
        if 'profession' in user_facts:
            personal_additions.append(f"With your background in {user_facts['profession']}, you probably have unique insights on this")
        
        if personal_additions:
            return f"{base_response} {random.choice(personal_additions)}."
        
        return base_response
    
    async def generate_response(
        self, 
        message: str, 
        conversation_history: List[Dict[str, Any]] = None,
        user_facts: Dict[str, str] = None
    ) -> str:
        """Generate AI response with rich context awareness"""
        
        # Simulate processing time
        await asyncio.sleep(random.uniform(0.3, 0.8))
        
        message_lower = message.lower()
        
        # Handle greetings
        if any(word in message_lower for word in ['hello', 'hi', 'hey', 'greetings']):
            return random.choice(self.greetings)
        
        # Detect emotions first
        emotions = self.detect_emotions(message)
        if emotions:
            primary_emotion = emotions[0]
            if primary_emotion in self.emotional_responses:
                response = random.choice(self.emotional_responses[primary_emotion])
                return self.build_personalized_response(response, user_facts or {})
        
        # Handle questions
        question_type = self.detect_question_type(message)
        if question_type and question_type in self.question_responses:
            response = random.choice(self.question_responses[question_type])
            return self.build_personalized_response(response, user_facts or {})
        
        # Handle topics
        topics = self.detect_topics(message)
        if topics:
            topic = topics[0]  # Use first detected topic
            if topic in self.topic_responses:
                response = random.choice(self.topic_responses[topic])
                return self.build_personalized_response(response, user_facts or {})
        
        # Check conversation history for context
        if conversation_history and len(conversation_history) > 2:
            # If we've been chatting for a while, occasionally ask deeper questions
            if random.random() < 0.3:  # 30% chance
                return random.choice(self.conversation_starters)
        
        # Default to thoughtful generic response
        response = random.choice(self.generic_responses)
        return self.build_personalized_response(response, user_facts or {})