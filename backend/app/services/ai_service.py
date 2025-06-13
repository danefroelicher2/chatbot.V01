import asyncio
import random
import re
import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

class EnhancedAIService:
    """Enhanced AI service with advanced conversation memory, multi-emotion detection, and personality consistency"""
    
    def __init__(self):
        # Expanded emotional responses with intensity levels
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
        
        # Intent-based responses
        self.intent_responses = {
            'advice_seeking': [
                "I can tell you're looking for some guidance on this. Let me share what I'm thinking...",
                "It sounds like you're weighing your options. Here's how I see the situation...",
                "You're asking exactly the right questions. From my perspective...",
                "I appreciate you trusting me with this decision. Here's what I'd consider..."
            ],
            'venting': [
                "It sounds like you really needed to get that out. I'm here to listen to whatever you need to share.",
                "I can hear how much you needed to express this. Sometimes we just need someone to hear us.",
                "Thank you for trusting me with these feelings. It takes courage to be so open.",
                "I'm glad you felt comfortable sharing this with me. Your feelings deserve to be heard."
            ],
            'sharing_news': [
                "Thank you for sharing this with me! I love being included in what's happening in your life.",
                "It means a lot that you thought to tell me about this. I'm genuinely interested in your updates!",
                "I appreciate you keeping me in the loop! What you share always adds richness to our conversations.",
                "I'm so glad you wanted to share this moment with me. These updates help me understand your world better."
            ],
            'seeking_support': [
                "I can tell you're going through something difficult. I'm here to support you however I can.",
                "It takes strength to reach out when things are hard. I'm honored that you'd come to me.",
                "I want you to know that you're not alone in this. I'm here to listen and support you.",
                "Thank you for trusting me with this. Let's work through this together."
            ]
        }
        
        # Personality traits for consistency
        self.personality_traits = {
            'empathetic': 0.9,      # How much to focus on emotions
            'curious': 0.8,         # How often to ask follow-up questions
            'supportive': 0.9,      # How much to offer encouragement
            'analytical': 0.6,      # How much to break down problems
            'playful': 0.5,         # How much humor/lightness to inject
            'direct': 0.4           # How straightforward vs gentle to be
        }
        
        # Enhanced emotion and topic keywords
        self.emotion_keywords = {
            'sad': {
                'low': ['down', 'blue', 'disappointed', 'bummed'],
                'medium': ['sad', 'upset', 'hurt', 'dejected'],
                'high': ['devastated', 'heartbroken', 'crushed', 'distraught', 'depressed']
            },
            'happy': {
                'low': ['good', 'nice', 'pleasant', 'okay'],
                'medium': ['happy', 'glad', 'pleased', 'cheerful'],
                'high': ['ecstatic', 'thrilled', 'overjoyed', 'elated', 'euphoric']
            },
            'frustrated': {
                'low': ['annoyed', 'bothered', 'irritated'],
                'medium': ['frustrated', 'aggravated', 'fed up'],
                'high': ['furious', 'enraged', 'livid', 'incensed']
            },
            'excited': {
                'low': ['interested', 'engaged', 'curious'],
                'medium': ['excited', 'enthusiastic', 'eager'],
                'high': ['thrilled', 'pumped', 'electrified', 'exhilarated']
            },
            'worried': {
                'low': ['concerned', 'unsure', 'uncertain'],
                'medium': ['worried', 'anxious', 'nervous'],
                'high': ['terrified', 'panicked', 'overwhelmed', 'frantic']
            }
        }
        
        # Topic detection patterns
        self.topic_patterns = {
            'work': {
                'keywords': ['job', 'work', 'career', 'boss', 'colleague', 'office', 'meeting', 'project', 'deadline', 'promotion'],
                'phrases': ['at work', 'my job', 'my boss', 'work meeting', 'office politics']
            },
            'family': {
                'keywords': ['family', 'mom', 'dad', 'parent', 'sibling', 'brother', 'sister', 'child', 'kids', 'son', 'daughter'],
                'phrases': ['my family', 'my parents', 'family dinner', 'family time']
            },
            'relationships': {
                'keywords': ['relationship', 'partner', 'dating', 'boyfriend', 'girlfriend', 'marriage', 'love', 'romance'],
                'phrases': ['my partner', 'relationship issues', 'dating life', 'love life']
            },
            'health': {
                'keywords': ['health', 'doctor', 'sick', 'exercise', 'diet', 'sleep', 'tired', 'energy', 'medical'],
                'phrases': ['feeling sick', 'health issues', 'doctor appointment', 'workout routine']
            },
            'goals': {
                'keywords': ['goal', 'dream', 'ambition', 'future', 'plan', 'hope', 'want', 'wish', 'achieve', 'success'],
                'phrases': ['my goal', 'future plans', 'want to achieve', 'working towards']
            }
        }
        
        # Memory templates for conversation summaries
        self.memory_templates = {
            'user_revelation': "User shared that they {fact} - this is important for understanding their {context}",
            'emotional_pattern': "User tends to feel {emotion} when discussing {topic}",
            'preference': "User prefers {style} communication style when {situation}",
            'recurring_theme': "User frequently mentions {theme} - this seems to be an ongoing concern/interest"
        }
    
    def detect_emotions_with_intensity(self, message: str) -> List[Dict[str, Any]]:
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
    
    def detect_intent(self, message: str, conversation_history: List[Dict] = None) -> str:
        """Detect user's intent from their message"""
        message_lower = message.lower()
        
        # Question patterns indicate advice seeking
        question_indicators = ['what should i', 'how do i', 'should i', 'what would you', 'do you think i should']
        if any(indicator in message_lower for indicator in question_indicators):
            return 'advice_seeking'
        
        # Frustration + explanation = venting
        frustration_words = ['annoying', 'frustrated', 'can\'t believe', 'so stupid', 'hate when']
        if any(word in message_lower for word in frustration_words) and len(message) > 50:
            return 'venting'
        
        # News/update sharing
        news_indicators = ['guess what', 'exciting news', 'wanted to tell you', 'just happened', 'update on']
        if any(indicator in message_lower for indicator in news_indicators):
            return 'sharing_news'
        
        # Support seeking
        support_indicators = ['going through', 'struggling with', 'having a hard time', 'need someone to talk']
        if any(indicator in message_lower for indicator in support_indicators):
            return 'seeking_support'
        
        return 'general_conversation'
    
    def extract_user_facts(self, message: str, user_id: int) -> List[Dict[str, Any]]:
        """Extract new facts about the user from their message"""
        facts = []
        message_lower = message.lower()
        
        # Name extraction
        name_patterns = [
            r"my name is (\w+)",
            r"i'm (\w+)",
            r"call me (\w+)",
            r"i go by (\w+)"
        ]
        for pattern in name_patterns:
            match = re.search(pattern, message_lower)
            if match:
                facts.append({
                    'fact_type': 'personal_info',
                    'key': 'name',
                    'value': match.group(1).title(),
                    'confidence': 0.9
                })
        
        # Job/profession extraction
        job_patterns = [
            r"i work as (?:a |an )?([^.,!?]+)",
            r"my job is ([^.,!?]+)",
            r"i'm (?:a |an )?([^.,!?]+)",
            r"profession is ([^.,!?]+)"
        ]
        for pattern in job_patterns:
            match = re.search(pattern, message_lower)
            if match:
                job = match.group(1).strip()
                if len(job) < 50 and not any(word in job for word in ['feeling', 'going', 'thinking']):
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
            r"my age is (\d{1,2})"
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
            r"i'm passionate about ([^.,!?]+)"
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
    
    def generate_conversation_summary(self, messages: List[Dict], themes: List[str]) -> Dict[str, Any]:
        """Generate a summary of key conversation points"""
        if not messages:
            return {}
        
        user_messages = [msg for msg in messages if msg.get('is_user', True)]
        ai_messages = [msg for msg in messages if not msg.get('is_user', True)]
        
        # Analyze emotional journey
        emotions_timeline = []
        for msg in user_messages:
            if 'detected_emotions' in msg and msg['detected_emotions']:
                emotions_timeline.append({
                    'timestamp': msg.get('timestamp', datetime.now()),
                    'emotions': msg['detected_emotions']
                })
        
        # Key topics discussed
        all_topics = []
        for msg in user_messages:
            if 'detected_topics' in msg:
                all_topics.extend(msg['detected_topics'])
        
        topic_frequency = defaultdict(int)
        for topic in all_topics:
            topic_frequency[topic] += 1
        
        return {
            'message_count': len(messages),
            'user_message_count': len(user_messages),
            'dominant_themes': themes,
            'emotional_journey': emotions_timeline,
            'main_topics': dict(sorted(topic_frequency.items(), key=lambda x: x[1], reverse=True)),
            'conversation_length': len(' '.join([msg['content'] for msg in user_messages])),
            'avg_message_length': sum(len(msg['content']) for msg in user_messages) / len(user_messages) if user_messages else 0
        }
    
    def select_response_template(self, emotions: List[Dict], intent: str, topics: List[str], user_profile: Dict = None) -> str:
        """Select the most appropriate response template based on context"""
        
        # Emotion-based responses take priority
        if emotions:
            primary_emotion = emotions[0]
            emotion_type = primary_emotion['emotion']
            intensity = primary_emotion['intensity']
            
            if emotion_type in self.emotional_responses and intensity in self.emotional_responses[emotion_type]:
                return random.choice(self.emotional_responses[emotion_type][intensity])
        
        # Intent-based responses
        if intent in self.intent_responses:
            return random.choice(self.intent_responses[intent])
        
        # Fallback to topic-based or generic
        generic_responses = [
            "That's really interesting. I'd love to hear more about your thoughts on this.",
            "You've given me something to think about. What's your experience been with this?",
            "I appreciate how openly you share. What's been on your mind about this lately?",
            "That's a fascinating perspective. Tell me more about how you see this situation."
        ]
        
        return random.choice(generic_responses)
    
    def build_personalized_response(self, base_response: str, user_facts: Dict[str, str], conversation_context: Dict = None) -> str:
        """Enhance responses with personalization and context"""
        response = base_response
        
        # Add name if known
        if 'name' in user_facts:
            if random.random() < 0.3:  # 30% chance to use name
                response = f"{user_facts['name']}, {response.lower()}"
        
        # Add context from previous conversations
        if conversation_context and 'previous_themes' in conversation_context:
            themes = conversation_context['previous_themes']
            if themes and random.random() < 0.2:  # 20% chance
                response += f" I remember we've talked about {themes[0]} before."
        
        # Add follow-up questions based on personality
        if random.random() < self.personality_traits['curious']:
            follow_ups = [
                " What's your take on this?",
                " How are you feeling about all of this?",
                " What's been the most challenging part?",
                " What would help you feel better about this situation?"
            ]
            response += random.choice(follow_ups)
        
        return response
    
    async def generate_response(
        self, 
        message: str, 
        conversation_history: List[Dict[str, Any]] = None,
        user_facts: Dict[str, str] = None,
        user_profile: Dict = None,
        conversation_context: Dict = None
    ) -> Dict[str, Any]:
        """Generate enhanced AI response with full context awareness"""
        
        # Simulate processing time
        await asyncio.sleep(random.uniform(0.4, 1.0))
        
        # Analyze the message
        emotions = self.detect_emotions_with_intensity(message)
        intent = self.detect_intent(message, conversation_history)
        topics = self.detect_topics(message)
        
        # Extract any new user facts
        new_facts = self.extract_user_facts(message, user_id=1)  # Default user
        
        # Select and personalize response
        base_response = self.select_response_template(emotions, intent, topics, user_profile)
        final_response = self.build_personalized_response(
            base_response, 
            user_facts or {}, 
            conversation_context
        )
        
        # Calculate sentiment score
        sentiment_score = self.calculate_sentiment_score(emotions)
        
        return {
            'response': final_response,
            'detected_emotions': emotions,
            'detected_topics': topics,
            'intent': intent,
            'sentiment_score': sentiment_score,
            'new_user_facts': new_facts,
            'response_metadata': {
                'template_type': intent,
                'primary_emotion': emotions[0]['emotion'] if emotions else None,
                'confidence': emotions[0]['score'] if emotions else 0.5
            }
        }
    
    def detect_topics(self, message: str) -> List[str]:
        """Enhanced topic detection using patterns and keywords"""
        message_lower = message.lower()
        detected_topics = []
        
        for topic, patterns in self.topic_patterns.items():
            score = 0
            
            # Check keywords
            for keyword in patterns['keywords']:
                if keyword in message_lower:
                    score += 1
            
            # Check phrases (weighted higher)
            for phrase in patterns.get('phrases', []):
                if phrase in message_lower:
                    score += 2
            
            if score > 0:
                detected_topics.append({
                    'topic': topic,
                    'confidence': min(score / 3.0, 1.0)
                })
        
        return [t['topic'] for t in sorted(detected_topics, key=lambda x: x['confidence'], reverse=True)]
    
    def calculate_sentiment_score(self, emotions: List[Dict]) -> float:
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