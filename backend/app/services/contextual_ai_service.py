"""
Context-Aware AI Service that generates direct responses to user content
Instead of template matching, this analyzes the actual meaning and responds contextually
"""

import asyncio
import random
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import json

class ContextualAIService:
    """AI Service that generates responses based on actual message content and context"""
    
    def __init__(self):
        # Core personality traits
        self.personality = {
            'empathy_level': 0.9,
            'curiosity_level': 0.8,
            'supportiveness': 0.9,
            'humor_level': 0.3,
            'directness': 0.6,
            'wisdom_level': 0.7
        }
        
        # Response building components
        self.conversation_starters = [
            "Tell me more about that.",
            "What's that like for you?", 
            "How does that make you feel?",
            "What's going through your mind about this?",
            "I'm curious about your perspective on this.",
            "What's the most important part of this for you?"
        ]
        
        self.acknowledgment_phrases = [
            "I hear you saying",
            "It sounds like",
            "I can sense that",
            "What I'm understanding is",
            "It seems like",
            "I'm picking up that"
        ]
        
        self.empathy_connectors = [
            "That must be",
            "I imagine that feels",
            "It sounds like that's",
            "I can understand why that would be",
            "That seems like it would be",
            "I bet that's"
        ]
        
        self.follow_up_questions = {
            'experience': [
                "What was that experience like?",
                "How did you handle that?",
                "What went through your mind when that happened?",
                "How are you processing that?"
            ],
            'feeling': [
                "How are you feeling about that now?",
                "What emotions are coming up for you?",
                "How is that sitting with you?",
                "What's your gut reaction to this?"
            ],
            'decision': [
                "What are you leaning towards?",
                "What feels right to you?",
                "What would help you decide?",
                "What's holding you back?"
            ],
            'relationship': [
                "How do you think they're feeling?",
                "What's your relationship like usually?",
                "Have you talked to them about this?",
                "What would you want them to know?"
            ],
            'future': [
                "What are you hoping for?",
                "What would an ideal outcome look like?",
                "What's your next step?",
                "How do you see this playing out?"
            ]
        }

    def extract_key_content(self, message: str) -> Dict[str, Any]:
        """Extract the key content and context from the user's message"""
        message_lower = message.lower()
        
        # Identify what the user is talking about
        content_analysis = {
            'main_subject': self._identify_main_subject(message),
            'emotional_context': self._analyze_emotional_context(message),
            'time_context': self._identify_time_context(message),
            'people_involved': self._identify_people(message),
            'action_or_event': self._identify_actions_events(message),
            'user_stance': self._identify_user_stance(message),
            'question_type': self._identify_question_type(message),
            'conversation_type': self._identify_conversation_type(message)
        }
        
        return content_analysis

    def _identify_main_subject(self, message: str) -> str:
        """Identify what the user is primarily talking about"""
        message_lower = message.lower()
        
        # Look for explicit subjects
        subject_patterns = {
            'work': ['work', 'job', 'career', 'boss', 'colleague', 'office', 'meeting', 'project'],
            'relationship': ['boyfriend', 'girlfriend', 'partner', 'husband', 'wife', 'dating', 'relationship'],
            'family': ['mom', 'dad', 'mother', 'father', 'family', 'parents', 'sibling', 'brother', 'sister'],
            'health': ['doctor', 'health', 'medical', 'sick', 'pain', 'therapy', 'medication'],
            'school': ['school', 'college', 'university', 'class', 'teacher', 'professor', 'exam', 'homework'],
            'friendship': ['friend', 'friends', 'friendship', 'buddy', 'pal'],
            'personal_growth': ['goal', 'dream', 'future', 'change', 'improve', 'better', 'growth'],
            'hobby': ['hobby', 'interest', 'passion', 'enjoy', 'love doing', 'favorite'],
            'daily_life': ['today', 'yesterday', 'routine', 'day', 'morning', 'evening'],
            'emotions': ['feel', 'feeling', 'emotion', 'mood', 'mental', 'anxiety', 'depression']
        }
        
        for subject, keywords in subject_patterns.items():
            if any(keyword in message_lower for keyword in keywords):
                return subject
        
        return 'general'

    def _analyze_emotional_context(self, message: str) -> Dict[str, Any]:
        """Analyze the emotional context beyond simple emotion detection"""
        message_lower = message.lower()
        
        emotional_indicators = {
            'positive': {
                'excitement': ['excited', 'thrilled', 'amazing', 'awesome', 'fantastic', 'incredible'],
                'happiness': ['happy', 'glad', 'pleased', 'cheerful', 'joyful', 'content'],
                'pride': ['proud', 'accomplished', 'achieved', 'succeeded', 'won'],
                'relief': ['relieved', 'better', 'finally', 'over', 'resolved'],
                'gratitude': ['thankful', 'grateful', 'appreciate', 'blessed', 'lucky']
            },
            'negative': {
                'frustration': ['frustrated', 'annoyed', 'irritated', 'fed up', 'sick of'],
                'sadness': ['sad', 'upset', 'down', 'depressed', 'heartbroken', 'disappointed'],
                'anxiety': ['worried', 'anxious', 'nervous', 'scared', 'afraid', 'stressed'],
                'anger': ['angry', 'mad', 'furious', 'pissed', 'rage', 'hate'],
                'confusion': ['confused', 'lost', 'don\'t understand', 'unclear', 'mixed up']
            },
            'neutral': {
                'contemplative': ['thinking', 'wondering', 'considering', 'pondering'],
                'curious': ['curious', 'interested', 'want to know', 'question'],
                'uncertain': ['maybe', 'perhaps', 'not sure', 'uncertain', 'might']
            }
        }
        
        detected_emotions = []
        emotional_intensity = 'medium'
        
        for valence, emotion_groups in emotional_indicators.items():
            for emotion, keywords in emotion_groups.items():
                for keyword in keywords:
                    if keyword in message_lower:
                        detected_emotions.append(emotion)
                        
                        # Check for intensity modifiers
                        if any(intensifier in message_lower for intensifier in ['really', 'very', 'extremely', 'so', 'incredibly']):
                            emotional_intensity = 'high'
                        elif any(mild in message_lower for mild in ['a bit', 'somewhat', 'kind of', 'slightly']):
                            emotional_intensity = 'low'
        
        return {
            'emotions': detected_emotions,
            'intensity': emotional_intensity,
            'overall_tone': self._determine_overall_tone(message_lower)
        }

    def _determine_overall_tone(self, message_lower: str) -> str:
        """Determine the overall tone of the message"""
        if any(word in message_lower for word in ['!', 'amazing', 'awesome', 'great', 'love']):
            return 'enthusiastic'
        elif any(word in message_lower for word in ['help', 'advice', 'should i', 'what do you think']):
            return 'seeking_guidance'
        elif any(word in message_lower for word in ['tired', 'exhausted', 'can\'t', 'difficult']):
            return 'weary'
        elif '?' in message_lower:
            return 'questioning'
        elif any(word in message_lower for word in ['hate', 'stupid', 'worst', 'terrible']):
            return 'venting'
        else:
            return 'conversational'

    def _identify_time_context(self, message: str) -> str:
        """Identify when the events/feelings are happening"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['today', 'right now', 'currently', 'at the moment']):
            return 'present'
        elif any(word in message_lower for word in ['yesterday', 'last week', 'ago', 'before', 'earlier']):
            return 'past'
        elif any(word in message_lower for word in ['tomorrow', 'next', 'will', 'going to', 'future']):
            return 'future'
        else:
            return 'general'

    def _identify_people(self, message: str) -> List[str]:
        """Identify other people mentioned in the message"""
        people_mentioned = []
        message_lower = message.lower()
        
        people_keywords = {
            'romantic_partner': ['boyfriend', 'girlfriend', 'partner', 'husband', 'wife'],
            'family': ['mom', 'dad', 'mother', 'father', 'parents', 'brother', 'sister', 'family'],
            'friends': ['friend', 'friends', 'buddy', 'pal'],
            'work_people': ['boss', 'colleague', 'coworker', 'manager', 'team'],
            'professionals': ['doctor', 'therapist', 'teacher', 'professor']
        }
        
        for category, keywords in people_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                people_mentioned.append(category)
        
        return people_mentioned

    def _identify_actions_events(self, message: str) -> List[str]:
        """Identify actions or events mentioned"""
        message_lower = message.lower()
        events = []
        
        event_patterns = {
            'conversation': ['talked to', 'said to', 'told', 'conversation', 'discussion'],
            'conflict': ['fight', 'argument', 'disagreement', 'conflict', 'yelled'],
            'achievement': ['got', 'won', 'achieved', 'accomplished', 'finished'],
            'loss': ['lost', 'broke up', 'ended', 'died', 'failed'],
            'change': ['started', 'began', 'changed', 'moved', 'new'],
            'decision': ['decided', 'chose', 'picked', 'selected', 'going with']
        }
        
        for event_type, keywords in event_patterns.items():
            if any(keyword in message_lower for keyword in keywords):
                events.append(event_type)
        
        return events

    def _identify_user_stance(self, message: str) -> str:
        """Identify the user's stance or attitude toward what they're discussing"""
        message_lower = message.lower()
        
        if any(phrase in message_lower for phrase in ['don\'t know', 'not sure', 'confused', 'uncertain']):
            return 'uncertain'
        elif any(phrase in message_lower for phrase in ['want to', 'need to', 'should', 'have to']):
            return 'motivated'
        elif any(phrase in message_lower for phrase in ['can\'t', 'won\'t', 'impossible', 'too hard']):
            return 'resistant'
        elif any(phrase in message_lower for phrase in ['love', 'enjoy', 'like', 'appreciate']):
            return 'positive'
        elif any(phrase in message_lower for phrase in ['hate', 'dislike', 'can\'t stand', 'annoying']):
            return 'negative'
        else:
            return 'neutral'

    def _identify_question_type(self, message: str) -> Optional[str]:
        """Identify what kind of question the user is asking, if any"""
        message_lower = message.lower()
        
        if not ('?' in message or any(q in message_lower for q in ['what', 'how', 'why', 'when', 'where', 'who', 'should i'])):
            return None
            
        question_types = {
            'advice': ['what should i', 'how should i', 'should i', 'what do you think'],
            'explanation': ['why', 'how does', 'what does', 'what is'],
            'information': ['when', 'where', 'who', 'what time'],
            'opinion': ['do you think', 'what\'s your opinion', 'how do you feel'],
            'validation': ['am i', 'is it okay', 'is that normal', 'does that make sense']
        }
        
        for q_type, patterns in question_types.items():
            if any(pattern in message_lower for pattern in patterns):
                return q_type
        
        return 'general_question'

    def _identify_conversation_type(self, message: str) -> str:
        """Identify what type of conversation the user wants"""
        message_lower = message.lower()
        
        if any(phrase in message_lower for phrase in ['need to talk', 'listen', 'vent', 'get this out']):
            return 'emotional_support'
        elif any(phrase in message_lower for phrase in ['advice', 'help', 'what should', 'recommend']):
            return 'guidance_seeking'
        elif any(phrase in message_lower for phrase in ['excited', 'guess what', 'news', 'happened']):
            return 'sharing_excitement'
        elif any(phrase in message_lower for phrase in ['think about', 'perspective', 'opinion', 'thoughts']):
            return 'intellectual_discussion'
        else:
            return 'general_conversation'

    def generate_contextual_response(self, content_analysis: Dict[str, Any], message: str, user_facts: Dict[str, str] = None) -> str:
        """Generate a response that directly addresses the user's message content"""
        
        # Start building the response
        response_parts = []
        
        # 1. Acknowledge what they're sharing
        acknowledgment = self._create_acknowledgment(content_analysis, message)
        if acknowledgment:
            response_parts.append(acknowledgment)
        
        # 2. Add empathetic response based on emotional context
        empathy = self._create_empathetic_response(content_analysis)
        if empathy:
            response_parts.append(empathy)
        
        # 3. Address the specific content
        content_response = self._address_specific_content(content_analysis, message)
        if content_response:
            response_parts.append(content_response)
        
        # 4. Add follow-up question or conversation continuation
        follow_up = self._create_follow_up(content_analysis)
        if follow_up:
            response_parts.append(follow_up)
        
        # 5. Personalize with user facts if available
        if user_facts:
            personalization = self._add_personalization(response_parts, user_facts, content_analysis)
            if personalization:
                response_parts.append(personalization)
        
        # Combine the parts into a natural response
        return self._combine_response_parts(response_parts)

    def _create_acknowledgment(self, content_analysis: Dict[str, Any], message: str) -> str:
        """Create an acknowledgment that shows we understand what they're saying"""
        main_subject = content_analysis['main_subject']
        emotions = content_analysis['emotional_context']['emotions']
        
        # Extract key phrases from their message for specific acknowledgment
        key_phrases = self._extract_key_phrases(message)
        
        if emotions:
            primary_emotion = emotions[0]
            if key_phrases:
                return f"{random.choice(self.acknowledgment_phrases)} you're feeling {primary_emotion} about {key_phrases[0]}."
            else:
                return f"{random.choice(self.acknowledgment_phrases)} you're feeling {primary_emotion}."
        elif key_phrases:
            return f"{random.choice(self.acknowledgment_phrases)} {key_phrases[0]} is really on your mind right now."
        else:
            return f"{random.choice(self.acknowledgment_phrases)} this is important to you."

    def _extract_key_phrases(self, message: str) -> List[str]:
        """Extract key phrases from the user's message"""
        # Simple extraction - look for noun phrases and important content
        message_lower = message.lower()
        key_phrases = []
        
        # Look for specific patterns that indicate important content
        patterns = [
            r"my (\w+(?:\s+\w+)*)",  # "my job", "my relationship"
            r"the (\w+(?:\s+\w+)*)",  # "the situation", "the problem"
            r"this (\w+(?:\s+\w+)*)",  # "this issue", "this feeling"
            r"(\w+ing) (?:with|about|for)",  # "dealing with", "thinking about"
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, message_lower)
            key_phrases.extend(matches)
        
        return key_phrases[:2]  # Return top 2 most relevant phrases

    def _create_empathetic_response(self, content_analysis: Dict[str, Any]) -> str:
        """Create an empathetic response based on emotional context"""
        emotions = content_analysis['emotional_context']['emotions']
        intensity = content_analysis['emotional_context']['intensity']
        tone = content_analysis['emotional_context']['overall_tone']
        
        if not emotions:
            return ""
        
        primary_emotion = emotions[0]
        
        empathy_responses = {
            'frustration': {
                'low': "That sounds mildly irritating.",
                'medium': "That sounds really frustrating to deal with.",
                'high': "That sounds absolutely infuriating. I can understand why you'd be so upset."
            },
            'sadness': {
                'low': "That sounds like it's weighing on you a bit.",
                'medium': "That sounds really hard to go through.",
                'high': "That sounds heartbreaking. I can only imagine how difficult this must be."
            },
            'anxiety': {
                'low': "That sounds like it's creating some worry for you.",
                'medium': "That sounds really stressful and anxiety-provoking.",
                'high': "That sounds overwhelming and terrifying. That level of anxiety must be exhausting."
            },
            'excitement': {
                'low': "That sounds nice!",
                'medium': "That sounds really exciting!",
                'high': "That sounds absolutely amazing! I can feel your excitement!"
            },
            'happiness': {
                'low': "That sounds pleasant.",
                'medium': "That sounds really wonderful!",
                'high': "That sounds incredible! I'm so happy for you!"
            }
        }
        
        if primary_emotion in empathy_responses and intensity in empathy_responses[primary_emotion]:
            return empathy_responses[primary_emotion][intensity]
        
        # Fallback empathetic responses
        return f"{random.choice(self.empathy_connectors)} {intensity} {primary_emotion}."

    def _address_specific_content(self, content_analysis: Dict[str, Any], message: str) -> str:
        """Address the specific content of what they're sharing"""
        main_subject = content_analysis['main_subject']
        conversation_type = content_analysis['conversation_type']
        question_type = content_analysis['question_type']
        user_stance = content_analysis['user_stance']
        
        # If they're asking a question, address it directly
        if question_type:
            return self._address_question(question_type, message, content_analysis)
        
        # If they're sharing something specific, respond to that
        if conversation_type == 'sharing_excitement':
            return "I love that you wanted to share this with me! Tell me more about what makes this so exciting for you."
        elif conversation_type == 'emotional_support':
            return "It sounds like you really needed to get this out. I'm here to listen to whatever you need to share."
        elif conversation_type == 'guidance_seeking':
            return "I can tell you're looking for some direction on this. Let me think about this with you."
        
        # Address based on their stance
        if user_stance == 'uncertain':
            return "It sounds like you're in a place where you're not quite sure what to think or feel about this."
        elif user_stance == 'resistant':
            return "It sounds like there are some real barriers or challenges that are making this feel impossible right now."
        elif user_stance == 'motivated':
            return "I can hear your determination to do something about this situation."
        
        # Subject-specific responses
        subject_responses = {
            'work': "Work situations can be so complex, especially when they affect how we feel day to day.",
            'relationship': "Relationships bring up such deep feelings, don't they? There's so much emotion involved.",
            'family': "Family dynamics can be some of the most complicated relationships we navigate.",
            'health': "Health concerns can be really scary and overwhelming, especially when we're not sure what's happening.",
            'personal_growth': "It takes real courage to work on growing and changing as a person."
        }
        
        return subject_responses.get(main_subject, "That sounds like something that's really been on your mind.")

    def _address_question(self, question_type: str, message: str, content_analysis: Dict[str, Any]) -> str:
        """Address specific types of questions"""
        message_lower = message.lower()
        
        if question_type == 'advice':
            return "That's a really important question you're asking. Let me think about this with you - what feels most important to you in this situation?"
        elif question_type == 'validation':
            return "It sounds like you're wondering if your feelings or reactions are normal, which is such a human thing to question."
        elif question_type == 'explanation':
            if 'why' in message_lower:
                return "That's such a thoughtful question. The 'why' behind things can be so important to understand."
            else:
                return "That's a great question - understanding how things work can really help us navigate them better."
        elif question_type == 'opinion':
            return "You're asking for my perspective, which means this is something you're really thinking through carefully."
        
        return "That's a really good question you're asking."

    def _create_follow_up(self, content_analysis: Dict[str, Any]) -> str:
        """Create an appropriate follow-up question or comment"""
        main_subject = content_analysis['main_subject']
        conversation_type = content_analysis['conversation_type']
        time_context = content_analysis['time_context']
        
        # Choose follow-up based on context
        if conversation_type == 'emotional_support':
            return random.choice(self.follow_up_questions['feeling'])
        elif conversation_type == 'guidance_seeking':
            return random.choice(self.follow_up_questions['decision'])
        elif main_subject in ['relationship', 'family']:
            return random.choice(self.follow_up_questions['relationship'])
        elif time_context == 'future':
            return random.choice(self.follow_up_questions['future'])
        else:
            return random.choice(self.follow_up_questions['experience'])

    def _add_personalization(self, response_parts: List[str], user_facts: Dict[str, str], content_analysis: Dict[str, Any]) -> str:
        """Add personalization based on known user facts"""
        if 'name' in user_facts and random.random() < 0.3:
            return f"I know this kind of thing is important to you, {user_facts['name']}."
        
        if 'profession' in user_facts and content_analysis['main_subject'] == 'work':
            return f"Given your work in {user_facts['profession']}, I imagine this has some unique challenges."
        
        return ""

    def _combine_response_parts(self, parts: List[str]) -> str:
        """Combine response parts into a natural-sounding response"""
        if not parts:
            return "I'm listening. Tell me more about what's on your mind."
        
        # Filter out empty parts
        parts = [part for part in parts if part and part.strip()]
        
        if len(parts) == 1:
            return parts[0]
        elif len(parts) == 2:
            return f"{parts[0]} {parts[1]}"
        elif len(parts) >= 3:
            # Combine first parts, then add follow-up
            main_response = f"{parts[0]} {parts[1]}"
            follow_up = parts[-1]
            return f"{main_response} {follow_up}"

    async def generate_response(
        self, 
        message: str, 
        conversation_history: List[Dict[str, Any]] = None,
        user_facts: Dict[str, str] = None,
        user_profile: Dict = None,
        conversation_context: Dict = None
    ) -> Dict[str, Any]:
        """Generate a contextual response that directly addresses what the user said"""
        
        # Simulate processing time
        await asyncio.sleep(random.uniform(0.3, 0.7))
        
        # Analyze the content of their message
        content_analysis = self.extract_key_content(message)
        
        # Generate contextual response
        response = self.generate_contextual_response(content_analysis, message, user_facts)
        
        # Also include the metadata for compatibility
        emotions = content_analysis['emotional_context']['emotions']
        emotion_data = [{'emotion': e, 'intensity': content_analysis['emotional_context']['intensity'], 'score': 0.8} for e in emotions[:2]]
        
        topics = [content_analysis['main_subject']] if content_analysis['main_subject'] != 'general' else []
        
        sentiment_score = 0.5  # Default neutral
        if emotions:
            if any(e in ['happiness', 'excitement', 'pride', 'relief', 'gratitude'] for e in emotions):
                sentiment_score = 0.7
            elif any(e in ['sadness', 'frustration', 'anxiety', 'anger'] for e in emotions):
                sentiment_score = 0.3
        
        return {
            'response': response,
            'detected_emotions': emotion_data,
            'detected_topics': topics,
            'intent': content_analysis['conversation_type'],
            'sentiment_score': sentiment_score,
            'new_user_facts': [],  # Would be filled by fact extraction
            'content_analysis': content_analysis,
            'response_metadata': {
                'response_type': 'contextual',
                'main_subject': content_analysis['main_subject'],
                'conversation_type': content_analysis['conversation_type']
            }
        }