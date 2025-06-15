"""
Enhanced AI Companion - Complete Fixed Version
All syntax errors resolved and ready to run
"""

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
import asyncio
import random
import re
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

# Create FastAPI app
app = FastAPI(title="Enhanced AI Companion Test", version="2.0.0")

# In-memory storage for testing
class MemoryStorage:
    def __init__(self):
        self.users = {}
        self.conversations = {}
        self.messages = {}
        self.user_facts = {}
        
    def get_user(self, user_id: int):
        if user_id not in self.users:
            self.users[user_id] = {
                'id': user_id,
                'name': None,
                'personality_profile': {
                    'communication_style': 'adaptive',
                    'preferred_response_length': 'medium',
                    'emotional_support_level': 'high'
                },
                'created_at': datetime.now()
            }
        return self.users[user_id]
    
    def save_conversation(self, user_id: int, title: str):
        conv_id = len(self.conversations) + 1
        self.conversations[conv_id] = {
            'id': conv_id,
            'user_id': user_id,
            'title': title,
            'created_at': datetime.now(),
            'last_message_at': datetime.now(),
            'dominant_emotion': None,
            'messages': []
        }
        return conv_id
    
    def save_message(self, conv_id: int, content: str, is_user: bool, metadata: Dict = None):
        msg_id = len(self.messages) + 1
        message = {
            'id': msg_id,
            'conversation_id': conv_id,
            'content': content,
            'is_user': is_user,
            'timestamp': datetime.now(),
            'metadata': metadata or {}
        }
        self.messages[msg_id] = message
        if conv_id in self.conversations:
            self.conversations[conv_id]['messages'].append(message)
        return msg_id
    
    def save_user_fact(self, user_id: int, fact_type: str, key: str, value: str, confidence: float):
        fact_key = f"{user_id}_{key}"
        self.user_facts[fact_key] = {
            'user_id': user_id,
            'fact_type': fact_type,
            'key': key,
            'value': value,
            'confidence': confidence,
            'created_at': datetime.now()
        }
    
    def get_user_facts(self, user_id: int):
        return {k.split('_', 1)[1]: v['value'] for k, v in self.user_facts.items() 
                if v['user_id'] == user_id}

# Global storage instance
storage = MemoryStorage()

# Enhanced AI Service
class EnhancedAIService:
    def __init__(self):
        self.emotional_responses = {
            'sad': {
                'low': [
                    "I can sense you're feeling a bit down. Sometimes talking about what's bothering us can help lighten the load.",
                    "It sounds like you're going through something challenging. I'm here to listen if you want to share.",
                    "I notice a hint of sadness in your words. Would you like to talk about what's on your mind?"
                ],
                'medium': [
                    "I can hear that you're dealing with something difficult right now. That must be really hard to carry.",
                    "It sounds like you're going through a tough time. I want you to know that your feelings are completely valid.",
                    "I can sense the weight of what you're experiencing. Sometimes it helps to talk through these feelings."
                ],
                'high': [
                    "I can feel the deep pain in your words, and I want you to know that I'm here with you in this moment.",
                    "This sounds incredibly overwhelming and heartbreaking. You don't have to face this alone.",
                    "I can sense how much you're hurting right now. That level of pain deserves acknowledgment and care."
                ]
            },
            'happy': {
                'low': [
                    "I can hear a positive note in your voice! It's nice to see you in good spirits.",
                    "There's something lovely about the way you're expressing yourself today. What's been going well?",
                    "I sense a lightness in your words that's really refreshing. What's bringing you joy?"
                ],
                'medium': [
                    "Your happiness is really coming through! I love hearing you in such good spirits.",
                    "There's such a wonderful energy in what you're sharing. What's been the highlight of your day?",
                    "I can feel your positive energy! It's genuinely heartwarming to hear you so upbeat."
                ],
                'high': [
                    "Your excitement is absolutely infectious! I'm practically beaming just reading your words!",
                    "The joy in your message is incredible! I'm so thrilled to share in this happiness with you!",
                    "Your enthusiasm is lighting up our entire conversation! This level of happiness is beautiful to witness!"
                ]
            },
            'frustrated': {
                'low': [
                    "I can sense some frustration in your words. That's completely understandable given the situation.",
                    "It sounds like something's been bothering you. Sometimes it helps to talk through what's not working.",
                    "I hear a note of irritation there. Want to tell me more about what's been getting under your skin?"
                ],
                'medium': [
                    "I can really hear the frustration building up. That must be incredibly draining to deal with.",
                    "This sounds genuinely aggravating. It's no wonder you're feeling fed up with the situation.",
                    "I can sense how much this is wearing on you. Dealing with ongoing frustration is exhausting."
                ],
                'high': [
                    "I can feel the intensity of your frustration. This sounds like it's reached a breaking point for you.",
                    "The level of aggravation you're experiencing sounds overwhelming. That's a lot to handle.",
                    "I can sense how deeply this is affecting you. This kind of intense frustration is really hard to bear."
                ]
            },
            'excited': {
                'low': [
                    "I can hear some enthusiasm in your voice! There's a nice energy to what you're sharing.",
                    "There's something exciting brewing in your words. What's got you feeling upbeat?",
                    "I sense a spark of excitement there! What's been capturing your interest?"
                ],
                'medium': [
                    "Your excitement is really coming through! I love hearing about what's energizing you.",
                    "There's such wonderful enthusiasm in what you're sharing! What's got you so pumped up?",
                    "I can feel your energy building! This excitement is really engaging to hear about."
                ],
                'high': [
                    "Your excitement is absolutely electric! I'm getting energized just hearing about this!",
                    "The enthusiasm radiating from your words is incredible! I'm practically bouncing with you!",
                    "Your excitement is so contagious I can barely contain myself! This sounds absolutely amazing!"
                ]
            },
            'worried': {
                'low': [
                    "I can sense some concern in your words. It's natural to worry when things feel uncertain.",
                    "There's a note of worry there that's completely understandable. What's been on your mind?",
                    "I hear some anxiety in what you're sharing. Sometimes talking through our worries can help."
                ],
                'medium': [
                    "I can feel the weight of your worry. These kinds of concerns can really consume our thoughts.",
                    "The anxiety you're experiencing sounds genuinely difficult. It's hard when our minds won't quiet down.",
                    "I can sense how much this uncertainty is affecting you. Worry can be such a heavy burden."
                ],
                'high': [
                    "I can feel the intensity of your anxiety. This level of worry must be incredibly overwhelming.",
                    "The depth of your concern is palpable. This kind of anxiety can feel all-consuming.",
                    "I can sense how this worry is gripping you. That level of anxiety is genuinely distressing to carry."
                ]
            }
        }
        
        self.emotion_keywords = {
            'sad': {
                'low': ['down', 'blue', 'disappointed', 'bummed', 'off'],
                'medium': ['sad', 'upset', 'hurt', 'dejected', 'unhappy'],
                'high': ['devastated', 'heartbroken', 'crushed', 'distraught', 'depressed']
            },
            'happy': {
                'low': ['good', 'nice', 'pleasant', 'okay', 'alright'],
                'medium': ['happy', 'glad', 'pleased', 'cheerful', 'content'],
                'high': ['ecstatic', 'thrilled', 'overjoyed', 'elated', 'euphoric']
            },
            'frustrated': {
                'low': ['annoyed', 'bothered', 'irritated', 'miffed'],
                'medium': ['frustrated', 'aggravated', 'fed up', 'angry'],
                'high': ['furious', 'enraged', 'livid', 'incensed']
            },
            'excited': {
                'low': ['interested', 'engaged', 'curious', 'intrigued'],
                'medium': ['excited', 'enthusiastic', 'eager', 'pumped'],
                'high': ['thrilled', 'exhilarated', 'electrified', 'ecstatic']
            },
            'worried': {
                'low': ['concerned', 'unsure', 'uncertain', 'uneasy'],
                'medium': ['worried', 'anxious', 'nervous', 'stressed'],
                'high': ['terrified', 'panicked', 'overwhelmed', 'frantic']
            }
        }
        
        self.topic_keywords = {
            'work': ['job', 'work', 'career', 'boss', 'colleague', 'office', 'meeting', 'project', 'deadline', 'promotion', 'workplace'],
            'family': ['family', 'mom', 'dad', 'parent', 'sibling', 'brother', 'sister', 'child', 'kids', 'son', 'daughter', 'grandmother', 'grandfather'],
            'relationships': ['relationship', 'partner', 'dating', 'boyfriend', 'girlfriend', 'marriage', 'love', 'romance', 'crush'],
            'health': ['health', 'doctor', 'sick', 'exercise', 'diet', 'sleep', 'tired', 'energy', 'medical', 'fitness'],
            'goals': ['goal', 'dream', 'ambition', 'future', 'plan', 'hope', 'want', 'wish', 'achieve', 'success', 'aspiration'],
            'hobbies': ['hobby', 'interest', 'passion', 'enjoy', 'fun', 'game', 'sport', 'music', 'art', 'read', 'travel']
        }

    def detect_emotions_with_intensity(self, message: str):
        """Detect multiple emotions with intensity levels"""
        message_lower = message.lower()
        detected_emotions = []
        
        for emotion, intensity_levels in self.emotion_keywords.items():
            max_intensity = 0
            intensity_level = 'low'
            
            for level, keywords in intensity_levels.items():
                for keyword in keywords:
                    if keyword in message_lower:
                        level_score = {'low': 1, 'medium': 2, 'high': 3}[level]
                        if level_score > max_intensity:
                            max_intensity = level_score
                            intensity_level = level
            
            if max_intensity > 0:
                detected_emotions.append({
                    'emotion': emotion,
                    'intensity': intensity_level,
                    'score': max_intensity / 3.0
                })
        
        return sorted(detected_emotions, key=lambda x: x['score'], reverse=True)

    def detect_topics(self, message: str):
        """Detect topics in the message"""
        message_lower = message.lower()
        detected_topics = []
        
        for topic, keywords in self.topic_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                detected_topics.append(topic)
        
        return detected_topics

    def detect_intent(self, message: str):
        """Detect user's intent from their message"""
        message_lower = message.lower()
        
        # Question patterns indicate advice seeking
        question_indicators = ['what should i', 'how do i', 'should i', 'what would you', 'do you think i should', 'advice', 'recommend']
        if any(indicator in message_lower for indicator in question_indicators):
            return 'advice_seeking'
        
        # Frustration + explanation = venting
        frustration_words = ['annoying', 'frustrated', 'cannot believe', 'so stupid', 'hate when', 'ugh', 'argh']
        if any(word in message_lower for word in frustration_words) and len(message) > 50:
            return 'venting'
        
        # News/update sharing
        news_indicators = ['guess what', 'exciting news', 'wanted to tell you', 'just happened', 'update', 'news']
        if any(indicator in message_lower for indicator in news_indicators):
            return 'sharing_news'
        
        # Support seeking
        support_indicators = ['going through', 'struggling with', 'having a hard time', 'need someone to talk', 'support', 'help me cope']
        if any(indicator in message_lower for indicator in support_indicators):
            return 'seeking_support'
        
        return 'general_conversation'

    def extract_user_facts(self, message: str):
        """Extract new facts about the user from their message"""
        facts = []
        message_lower = message.lower()
        
        # Name extraction
        name_patterns = [
            r"my name is (\w+)",
            r"i'm (\w+)(?:\s|$|,|\.)",
            r"call me (\w+)",
            r"i go by (\w+)"
        ]
        for pattern in name_patterns:
            match = re.search(pattern, message_lower)
            if match:
                name = match.group(1).title()
                if name not in ['A', 'An', 'The', 'So', 'Very', 'Really']:  # Filter out common words
                    facts.append({
                        'fact_type': 'personal_info',
                        'key': 'name',
                        'value': name,
                        'confidence': 0.9
                    })
        
        # Job/profession extraction
        job_patterns = [
            r"i work as (?:a |an )?([^.,!?]+)",
            r"my job is ([^.,!?]+)",
            r"i'm (?:a |an )?([^.,!?]+)",
            r"profession is ([^.,!?]+)",
            r"i do ([^.,!?]+) for work"
        ]
        for pattern in job_patterns:
            match = re.search(pattern, message_lower)
            if match:
                job = match.group(1).strip()
                # Filter out obvious non-jobs
                non_jobs = ['feeling', 'going', 'thinking', 'happy', 'sad', 'excited', 'worried', 'frustrated']
                if len(job) < 50 and not any(word in job for word in non_jobs):
                    facts.append({
                        'fact_type': 'personal_info',
                        'key': 'profession',
                        'value': job,
                        'confidence': 0.8
                    })
        
        # Age extraction
        age_patterns = [
            r"i'm (\d{1,2}) years old",
            r"i am (\d{1,2})",
            r"my age is (\d{1,2})",
            r"(\d{1,2}) years old"
        ]
        for pattern in age_patterns:
            match = re.search(pattern, message_lower)
            if match:
                age = int(match.group(1))
                if 13 <= age <= 99:  # Reasonable age range
                    facts.append({
                        'fact_type': 'personal_info',
                        'key': 'age',
                        'value': str(age),
                        'confidence': 0.9
                    })
        
        # Interests/hobbies
        interest_patterns = [
            r"i love ([^.,!?]+)",
            r"i enjoy ([^.,!?]+)",
            r"my hobby is ([^.,!?]+)",
            r"i'm passionate about ([^.,!?]+)",
            r"i like ([^.,!?]+)"
        ]
        for pattern in interest_patterns:
            match = re.search(pattern, message_lower)
            if match:
                interest = match.group(1).strip()
                if len(interest) < 50:
                    facts.append({
                        'fact_type': 'interest',
                        'key': 'hobby',
                        'value': interest,
                        'confidence': 0.7
                    })
        
        return facts

    def calculate_sentiment_score(self, emotions):
        """Calculate overall sentiment score from emotions"""
        if not emotions:
            return 0.0
        
        sentiment_weights = {
            'happy': 1.0,
            'excited': 0.8,
            'sad': -0.8,
            'frustrated': -0.6,
            'worried': -0.4
        }
        
        total_score = 0
        total_weight = 0
        
        for emotion in emotions:
            weight = sentiment_weights.get(emotion['emotion'], 0)
            intensity_multiplier = {'low': 0.3, 'medium': 0.7, 'high': 1.0}[emotion['intensity']]
            score = weight * intensity_multiplier * emotion['score']
            
            total_score += score
            total_weight += emotion['score']
        
        return total_score / total_weight if total_weight > 0 else 0.0

    def select_response_template(self, emotions, intent, user_facts):
        """Select the most appropriate response template"""
        
        # Emotion-based responses take priority
        if emotions:
            primary_emotion = emotions[0]
            emotion_type = primary_emotion['emotion']
            intensity = primary_emotion['intensity']
            
            if emotion_type in self.emotional_responses and intensity in self.emotional_responses[emotion_type]:
                base_response = random.choice(self.emotional_responses[emotion_type][intensity])
                
                # Add personalization
                if 'name' in user_facts:
                    if random.random() < 0.3:  # 30% chance to use name
                        base_response = f"{user_facts['name']}, {base_response.lower()}"
                
                return base_response
        
        # Intent-based responses
        intent_responses = {
            'advice_seeking': [
                "I can tell you're looking for some guidance on this. Let me share what I'm thinking...",
                "It sounds like you're weighing your options. Here's how I see the situation...",
                "You're asking exactly the right questions. From my perspective..."
            ],
            'venting': [
                "It sounds like you really needed to get that out. I'm here to listen to whatever you need to share.",
                "I can hear how much you needed to express this. Sometimes we just need someone to hear us.",
                "Thank you for trusting me with these feelings. It takes courage to be so open."
            ],
            'sharing_news': [
                "Thank you for sharing this with me! I love being included in what's happening in your life.",
                "It means a lot that you thought to tell me about this. I'm genuinely interested in your updates!",
                "I appreciate you keeping me in the loop! What you share always adds richness to our conversations."
            ],
            'seeking_support': [
                "I can tell you're going through something difficult. I'm here to support you however I can.",
                "It takes strength to reach out when things are hard. I'm honored that you'd come to me.",
                "I want you to know that you're not alone in this. I'm here to listen and support you."
            ]
        }
        
        if intent in intent_responses:
            return random.choice(intent_responses[intent])
        
        # Generic responses
        generic_responses = [
            "That's really interesting. I'd love to hear more about your thoughts on this.",
            "You've given me something to think about. What's your experience been with this?",
            "I appreciate how openly you share. What's been on your mind about this lately?",
            "That's a fascinating perspective. Tell me more about how you see this situation.",
            "I find your way of looking at things really refreshing. What led you to that conclusion?",
            "You have such a unique way of seeing things. I'd love to hear more about your perspective."
        ]
        
        return random.choice(generic_responses)

    async def generate_response(self, message, user_facts=None):
        """Generate enhanced AI response"""
        await asyncio.sleep(random.uniform(0.4, 1.0))
        
        emotions = self.detect_emotions_with_intensity(message)
        topics = self.detect_topics(message)
        intent = self.detect_intent(message)
        new_facts = self.extract_user_facts(message)
        sentiment_score = self.calculate_sentiment_score(emotions)
        
        response = self.select_response_template(emotions, intent, user_facts or {})
        
        return {
            'response': response,
            'detected_emotions': emotions,
            'detected_topics': topics,
            'intent': intent,
            'sentiment_score': sentiment_score,
            'new_user_facts': new_facts
        }

# Initialize AI service
ai_service = EnhancedAIService()

# Serve the enhanced chat interface
@app.get("/", response_class=HTMLResponse)
async def read_root():
    return HTMLResponse(content=open('chat_interface.html', 'r').read() if os.path.exists('chat_interface.html') else get_default_html())

def get_default_html():
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
            background-color: #0f0f0f; color: #ffffff; height: 100vh; overflow: hidden;
        }
        .container { display: flex; height: 100vh; }
        
        /* Enhanced Sidebar */
        .sidebar {
            width: 300px; background-color: #171717; border-right: 1px solid #333;
            display: flex; flex-direction: column; padding: 20px; overflow-y: auto;
        }
        .sidebar h2 { color: #ffffff; margin-bottom: 20px; font-size: 18px; font-weight: 600; }
        .new-chat-btn {
            background-color: #333; color: #ffffff; border: 1px solid #555;
            padding: 12px 16px; border-radius: 8px; cursor: pointer; margin-bottom: 20px;
            font-size: 14px; transition: background-color 0.2s;
        }
        .new-chat-btn:hover { background-color: #444; }
        .conversation-list { flex: 1; overflow-y: auto; margin-bottom: 20px; }
        .conversation-item {
            padding: 12px; margin-bottom: 8px; background-color: #222; border-radius: 8px;
            cursor: pointer; transition: background-color 0.2s; border: 1px solid transparent;
        }
        .conversation-item:hover { background-color: #333; }
        .conversation-item.active { background-color: #2563eb; border-color: #3b82f6; }
        .conversation-title {
            font-size: 14px; font-weight: 500; margin-bottom: 4px; color: #ffffff;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .conversation-time { font-size: 12px; color: #888; }
        
        /* Conversation Insights */
        .conversation-insights {
            background-color: #222; border-radius: 8px; padding: 12px; margin-top: 16px;
        }
        .insights-header {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
        }
        .insights-header h3 { font-size: 14px; color: #ffffff; }
        .toggle-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 12px; }
        .toggle-btn:hover { color: #ffffff; }
        .insights-content { display: flex; flex-direction: column; gap: 8px; }
        .insight-item { display: flex; flex-direction: column; gap: 4px; }
        .insight-label { font-size: 11px; color: #888; font-weight: 500; }
        .insight-value { font-size: 12px; color: #ffffff; }
        
        /* Main Chat */
        .main-chat { flex: 1; display: flex; flex-direction: column; background-color: #0f0f0f; }
        .chat-header {
            padding: 20px 24px; border-bottom: 1px solid #333; background-color: #171717;
        }
        .chat-header h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
        .status { font-size: 14px; color: #10b981; }
        
        /* Emotion Indicator */
        .emotion-indicator {
            margin-top: 8px; padding: 8px 12px; background-color: #222;
            border-radius: 6px; border: 1px solid #333;
        }
        .emotion-display { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .emotion-value { font-weight: 500; padding: 2px 6px; border-radius: 4px; }
        .emotion-happy { background-color: #10b981; color: #ffffff; }
        .emotion-sad { background-color: #6366f1; color: #ffffff; }
        .emotion-frustrated { background-color: #ef4444; color: #ffffff; }
        .emotion-excited { background-color: #f59e0b; color: #ffffff; }
        .emotion-worried { background-color: #8b5cf6; color: #ffffff; }
        
        .chat-container { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .chat-messages {
            flex: 1; overflow-y: auto; padding: 24px;
            display: flex; flex-direction: column; gap: 16px;
        }
        
        /* Enhanced Messages */
        .message {
            max-width: 80%; display: flex; flex-direction: column; gap: 4px;
            animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .user-message { align-self: flex-end; }
        .ai-message { align-self: flex-start; }
        .message-content {
            padding: 12px 16px; border-radius: 16px; font-size: 15px;
            line-height: 1.4; word-wrap: break-word;
        }
        .user-message .message-content {
            background-color: #2563eb; color: #ffffff; border-bottom-right-radius: 4px;
        }
        .ai-message .message-content {
            background-color: #333; color: #ffffff; border-bottom-left-radius: 4px;
        }
        
        /* Message Metadata */
        .message-metadata { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
        .emotion-tag, .topic-tag, .facts-tag, .intent-tag {
            font-size: 10px; padding: 2px 6px; border-radius: 10px; font-weight: 500;
        }
        .emotion-tag { background-color: #8b5cf6; color: #ffffff; }
        .topic-tag { background-color: #06b6d4; color: #ffffff; }
        .facts-tag { background-color: #10b981; color: #ffffff; }
        .intent-tag { background-color: #f59e0b; color: #ffffff; }
        
        .message-time {
            font-size: 12px; color: #888; align-self: flex-end; margin-top: 2px;
        }
        .user-message .message-time { align-self: flex-end; }
        .ai-message .message-time { align-self: flex-start; }
        
        /* Chat Input */
        .chat-input-container {
            padding: 24px; border-top: 1px solid #333; background-color: #171717;
        }
        .chat-input-wrapper {
            display: flex; gap: 12px; align-items: flex-end; max-width: 800px; margin: 0 auto;
        }
        #messageInput {
            flex: 1; background-color: #333; border: 1px solid #555; color: #ffffff;
            padding: 12px 16px; border-radius: 12px; font-size: 15px; font-family: inherit;
            resize: none; min-height: 44px; max-height: 120px; line-height: 1.4;
        }
        #messageInput:focus { outline: none; border-color: #2563eb; }
        #messageInput::placeholder { color: #888; }
        #sendBtn {
            background-color: #2563eb; color: #ffffff; border: none;
            padding: 12px 20px; border-radius: 12px; cursor: pointer;
            font-size: 15px; font-weight: 500; transition: background-color 0.2s; min-width: 80px;
        }
        #sendBtn:hover { background-color: #1d4ed8; }
        #sendBtn:disabled { background-color: #555; cursor: not-allowed; }
        
        /* Scrollbar styling */
        .chat-messages::-webkit-scrollbar,
        .conversation-list::-webkit-scrollbar,
        .sidebar::-webkit-scrollbar { width: 6px; }
        .chat-messages::-webkit-scrollbar-track,
        .conversation-list::-webkit-scrollbar-track,
        .sidebar::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb,
        .conversation-list::-webkit-scrollbar-thumb,
        .sidebar::-webkit-scrollbar-thumb { background-color: #555; border-radius: 3px; }
        .chat-messages::-webkit-scrollbar-thumb:hover,
        .conversation-list::-webkit-scrollbar-thumb:hover,
        .sidebar::-webkit-scrollbar-thumb:hover { background-color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="sidebar">
            <h2>Conversations</h2>
            <button id="newChatBtn" class="new-chat-btn">+ New Chat</button>
            <div id="conversationList" class="conversation-list">
                <!-- Conversations will be loaded here -->
            </div>
            
            <div class="conversation-insights">
                <div class="insights-header">
                    <h3>Conversation Insights</h3>
                    <button id="toggleInsights" class="toggle-btn">Hide</button>
                </div>
                <div class="insights-content" id="insightsContent">
                    <div class="insight-item">
                        <span class="insight-label">Topics Discussed:</span>
                        <span class="insight-value" id="discussedTopics">None yet</span>
                    </div>
                    <div class="insight-item">
                        <span class="insight-label">Emotions Detected:</span>
                        <span class="insight-value" id="emotionsDetected">None yet</span>
                    </div>
                    <div class="insight-item">
                        <span class="insight-label">Facts Learned:</span>
                        <span class="insight-value" id="factsLearned">0</span>
                    </div>
                    <div class="insight-item">
                        <span class="insight-label">Session Intent:</span>
                        <span class="insight-value" id="sessionIntent">General conversation</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="main-chat">
            <div class="chat-header">
                <h1>🧠 AI Companion</h1>
                <div class="status" id="status">Ready for meaningful conversation</div>
                <div class="emotion-indicator">
                    <div class="emotion-display">
                        <span class="emotion-label">Current mood:</span>
                        <span class="emotion-value" id="currentEmotion">Neutral</span>
                    </div>
                </div>
            </div>
            
            <div id="chatContainer" class="chat-container">
                <div id="chatMessages" class="chat-messages">
                    <div class="message ai-message">
                        <div class="message-content">
                            Hello! I'm your enhanced AI companion with emotional intelligence and learning capabilities. I can detect your emotions, learn facts about you, and have meaningful conversations. Try telling me your name or sharing how you're feeling!
                        </div>
                        <div class="message-time">Now</div>
                    </div>
                </div>
            </div>
            
            <div class="chat-input-container">
                <div class="chat-input-wrapper">
                    <textarea id="messageInput" placeholder="Share what's on your mind..." rows="1"></textarea>
                    <button id="sendBtn">Send</button>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        class EnhancedChatApp {
            constructor() {
                this.currentConversationId = null;
                this.userId = 1;
                this.sessionStats = {
                    factsLearned: 0,
                    topics: new Set(),
                    emotions: new Set(),
                    intents: new Set(),
                    userName: null
                };
                
                this.initializeElements();
                this.attachEventListeners();
                this.loadConversations();
            }
            
            initializeElements() {
                this.messageInput = document.getElementById('messageInput');
                this.sendBtn = document.getElementById('sendBtn');
                this.chatMessages = document.getElementById('chatMessages');
                this.conversationList = document.getElementById('conversationList');
                this.newChatBtn = document.getElementById('newChatBtn');
                this.currentEmotion = document.getElementById('currentEmotion');
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
                this.messageInput.addEventListener('input', () => {
                    this.autoResizeTextarea();
                    this.analyzeTyping();
                });
                this.newChatBtn.addEventListener('click', () => this.startNewChat());
                document.getElementById('toggleInsights')?.addEventListener('click', () => this.toggleInsights());
            }
            
            autoResizeTextarea() {
                this.messageInput.style.height = 'auto';
                this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
            }
            
            analyzeTyping() {
                const text = this.messageInput.value.toLowerCase();
                if (text.length < 3) return;
                
                const emotions = {
                    happy: ['happy', 'joy', 'great', 'awesome', 'wonderful', 'excited'],
                    sad: ['sad', 'upset', 'down', 'depressed', 'disappointed'],
                    frustrated: ['frustrated', 'annoyed', 'angry', 'mad', 'irritated'],
                    excited: ['excited', 'thrilled', 'pumped', 'enthusiastic']
                };
                
                for (const [emotion, keywords] of Object.entries(emotions)) {
                    if (keywords.some(word => text.includes(word))) {
                        this.currentEmotion.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
                        this.currentEmotion.className = `emotion-value emotion-${emotion}`;
                        break;
                    }
                }
            }
            
            async sendMessage() {
                const message = this.messageInput.value.trim();
                if (!message) return;
                
                this.messageInput.value = '';
                this.messageInput.style.height = 'auto';
                this.sendBtn.disabled = true;
                this.currentEmotion.textContent = 'Neutral';
                this.currentEmotion.className = 'emotion-value';
                
                this.addMessage(message, true);
                this.showTypingIndicator();
                
                try {
                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: message, user_id: this.userId })
                    });
                    
                    const data = await response.json();
                    this.hideTypingIndicator();
                    this.addEnhancedMessage(data.response, false, data);
                    this.updateSessionStats(data);
                    
                } catch (error) {
                    console.error('Error sending message:', error);
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
                
                this.chatMessages.appendChild(messageDiv);
                this.scrollToBottom();
            }
            
            addEnhancedMessage(content, isUser, metadata = null) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
                const now = new Date();
                const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                let metadataHtml = '';
                if (metadata && !isUser) {
                    const tags = [];
                    if (metadata.detected_emotions?.length) {
                        tags.push(`<span class="emotion-tag">${metadata.detected_emotions[0].emotion}</span>`);
                    }
                    if (metadata.detected_topics?.length) {
                        tags.push(`<span class="topic-tag">${metadata.detected_topics.join(', ')}</span>`);
                    }
                    if (metadata.new_user_facts?.length) {
                        tags.push(`<span class="facts-tag">+${metadata.new_user_facts.length} facts</span>`);
                    }
                    if (metadata.intent) {
                        tags.push(`<span class="intent-tag">${metadata.intent}</span>`);
                    }
                    
                    if (tags.length > 0) {
                        metadataHtml = `<div class="message-metadata">${tags.join('')}</div>`;
                    }
                }
                
                messageDiv.innerHTML = `
                    <div class="message-content">${this.escapeHtml(content)}</div>
                    ${metadataHtml}
                    <div class="message-time">${timeString}</div>
                `;
                
                this.chatMessages.appendChild(messageDiv);
                this.scrollToBottom();
            }
            
            updateSessionStats(data) {
                // Update facts learned
                if (data.new_user_facts?.length) {
                    this.sessionStats.factsLearned += data.new_user_facts.length;
                    document.getElementById('factsLearned').textContent = this.sessionStats.factsLearned;
                    
                    // Check for name
                    data.new_user_facts.forEach(fact => {
                        if (fact.key === 'name') {
                            this.sessionStats.userName = fact.value;
                            this.status.textContent = `Hi ${fact.value}! Ready for meaningful conversation`;
                        }
                    });
                }
                
                // Update topics
                if (data.detected_topics?.length) {
                    data.detected_topics.forEach(topic => this.sessionStats.topics.add(topic));
                    document.getElementById('discussedTopics').textContent = 
                        this.sessionStats.topics.size ? Array.from(this.sessionStats.topics).join(', ') : 'None yet';
                }
                
                // Update emotions
                if (data.detected_emotions?.length) {
                    data.detected_emotions.forEach(emotion => this.sessionStats.emotions.add(emotion.emotion));
                    document.getElementById('emotionsDetected').textContent = 
                        this.sessionStats.emotions.size ? Array.from(this.sessionStats.emotions).join(', ') : 'None yet';
                }
                
                // Update intent
                if (data.intent) {
                    this.sessionStats.intents.add(data.intent);
                    document.getElementById('sessionIntent').textContent = data.intent.replace('_', ' ');
                }
            }
            
            showTypingIndicator() {
                const typingDiv = document.createElement('div');
                typingDiv.className = 'message ai-message';
                typingDiv.id = 'typingIndicator';
                typingDiv.innerHTML = `
                    <div class="message-content" style="color: #888; font-style: italic;">
                        AI is analyzing and thinking...
                    </div>
                `;
                this.chatMessages.appendChild(typingDiv);
                this.scrollToBottom();
            }
            
            hideTypingIndicator() {
                const typingIndicator = document.getElementById('typingIndicator');
                if (typingIndicator) typingIndicator.remove();
            }
            
            scrollToBottom() {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
            
            escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            async loadConversations() {
                // Placeholder for conversation loading
                // This would fetch from your API in a full implementation
                this.conversationList.innerHTML = '<div style="color: #888; font-size: 12px; padding: 8px;">Start chatting to see conversations</div>';
            }
            
            startNewChat() {
                this.currentConversationId = null;
                this.sessionStats = {
                    factsLearned: 0,
                    topics: new Set(),
                    emotions: new Set(),
                    intents: new Set(),
                    userName: null
                };
                
                this.chatMessages.innerHTML = `
                    <div class="message ai-message">
                        <div class="message-content">
                            Hello! I'm your enhanced AI companion with emotional intelligence and learning capabilities. I can detect your emotions, learn facts about you, and have meaningful conversations. Try telling me your name or sharing how you're feeling!
                        </div>
                        <div class="message-time">Now</div>
                    </div>
                `;
                
                // Reset insights
                document.getElementById('discussedTopics').textContent = 'None yet';
                document.getElementById('emotionsDetected').textContent = 'None yet';
                document.getElementById('factsLearned').textContent = '0';
                document.getElementById('sessionIntent').textContent = 'General conversation';
                
                this.messageInput.focus();
            }
            
            toggleInsights() {
                const insightsContent = document.getElementById('insightsContent');
                const toggleBtn = document.getElementById('toggleInsights');
                
                if (insightsContent.style.display === 'none') {
                    insightsContent.style.display = 'flex';
                    toggleBtn.textContent = 'Hide';
                } else {
                    insightsContent.style.display = 'none';
                    toggleBtn.textContent = 'Show';
                }
            }
        }
        
        // Initialize the enhanced chat app when the page loads
        document.addEventListener('DOMContentLoaded', () => {
            new EnhancedChatApp();
        });
    </script>
</body>
</html>"""

# Enhanced chat endpoint
@app.post("/api/chat")
async def chat_endpoint(request: Request):
    try:
        body = await request.json()
        message = body.get('message', '')
        user_id = body.get('user_id', 1)
        
        if not message:
            return JSONResponse({"error": "Message is required"}, status_code=400)
        
        # Get user and facts
        user = storage.get_user(user_id)
        user_facts = storage.get_user_facts(user_id)
        
        # Generate AI response
        ai_result = await ai_service.generate_response(message, user_facts)
        
        # Save new facts
        for fact in ai_result['new_user_facts']:
            storage.save_user_fact(
                user_id, 
                fact['fact_type'],
                fact['key'], 
                fact['value'], 
                fact['confidence']
            )
        
        # Create or get conversation
        conv_id = storage.save_conversation(user_id, message[:50] + "..." if len(message) > 50 else message)
        
        # Save messages
        storage.save_message(conv_id, message, True, ai_result)
        storage.save_message(conv_id, ai_result['response'], False)
        
        return JSONResponse({
            "response": ai_result['response'],
            "conversation_id": conv_id,
            "detected_emotions": ai_result['detected_emotions'],
            "detected_topics": ai_result['detected_topics'],
            "intent": ai_result['intent'],
            "sentiment_score": ai_result['sentiment_score'],
            "new_user_facts": ai_result['new_user_facts'],
            "new_facts_learned": len(ai_result['new_user_facts'])
        })
    
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# User profile endpoint
@app.get("/api/user/{user_id}/profile")
async def get_user_profile(user_id: int):
    user = storage.get_user(user_id)
    user_facts = storage.get_user_facts(user_id)
    
    return JSONResponse({
        "user_id": user_id,
        "name": user_facts.get('name'),
        "facts_count": len(user_facts),
        "personality_traits": user['personality_profile'],
        "known_facts": user_facts
    })

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "message": "Enhanced AI Companion (Complete Fixed Version) is running",
        "version": "2.0.0-complete",
        "features": [
            "Multi-emotion detection with intensity",
            "Advanced topic recognition", 
            "User fact learning and memory",
            "Intent classification",
            "Sentiment analysis",
            "In-memory storage for testing",
            "All syntax errors resolved",
            "Complete HTML interface"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    import os
    uvicorn.run(app, host="0.0.0.0", port=8000)