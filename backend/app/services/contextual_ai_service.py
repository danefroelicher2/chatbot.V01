"""
Enhanced Conversational AI Service
This dramatically improves conversational ability with:
1. Deep message content analysis
2. Dynamic response building that addresses specific content
3. Natural language generation with flowing responses
4. Context threading that references previous conversation parts
5. Memory management with automatic new chat creation
"""

import asyncio
import random
import re
import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict, deque
import logging

class ConversationMemory:
    """Manages conversation memory with automatic overflow handling"""
    
    def __init__(self, max_messages: int = 50, max_context_length: int = 15000):
        self.max_messages = max_messages
        self.max_context_length = max_context_length
        self.messages = deque(maxlen=max_messages)
        self.key_facts = {}  # Important facts extracted from conversation
        self.emotional_journey = []  # Track emotional progression
        self.topics_discussed = {}  # Topics and their frequency
        self.user_patterns = {}  # Communication patterns observed
        
    def add_message(self, message: Dict[str, Any]):
        """Add message and extract key information"""
        self.messages.append(message)
        
        # Extract and store key facts
        if message['is_user']:
            self._extract_key_facts(message)
            self._track_emotional_state(message)
            self._track_topics(message)
            
    def _extract_key_facts(self, message: Dict[str, Any]):
        """Extract important facts to remember"""
        content = message['content'].lower()
        
        # Extract temporal references
        if 'tomorrow' in content:
            self.key_facts['upcoming_event'] = 'tomorrow'
        elif 'next week' in content:
            self.key_facts['upcoming_event'] = 'next week'
            
        # Extract specific subjects they mention frequently
        subjects = re.findall(r'my (\w+(?:\s+\w+)*)', content)
        for subject in subjects:
            if subject not in self.key_facts.get('personal_subjects', []):
                if 'personal_subjects' not in self.key_facts:
                    self.key_facts['personal_subjects'] = []
                self.key_facts['personal_subjects'].append(subject)
    
    def _track_emotional_state(self, message: Dict[str, Any]):
        """Track emotional progression through conversation"""
        if message.get('detected_emotions'):
            emotion_data = {
                'timestamp': message['timestamp'],
                'emotions': message['detected_emotions'],
                'content_summary': message['content'][:100] + "..." if len(message['content']) > 100 else message['content']
            }
            self.emotional_journey.append(emotion_data)
            
    def _track_topics(self, message: Dict[str, Any]):
        """Track topics and their importance in conversation"""
        if message.get('detected_topics'):
            for topic in message['detected_topics']:
                if topic in self.topics_discussed:
                    self.topics_discussed[topic]['count'] += 1
                    self.topics_discussed[topic]['last_mentioned'] = message['timestamp']
                else:
                    self.topics_discussed[topic] = {
                        'count': 1,
                        'first_mentioned': message['timestamp'],
                        'last_mentioned': message['timestamp']
                    }
    
    def should_start_new_chat(self) -> Tuple[bool, str]:
        """Determine if memory is overloaded and new chat should start"""
        if len(self.messages) >= self.max_messages:
            return True, "conversation_length"
            
        # Calculate total context length
        total_length = sum(len(msg['content']) for msg in self.messages)
        if total_length >= self.max_context_length:
            return True, "context_length"
            
        # Check if too many different topics (conversation becoming unfocused)
        if len(self.topics_discussed) > 8:
            return True, "topic_overload"
            
        return False, None
    
    def get_memory_summary(self) -> Dict[str, Any]:
        """Get summary of what's been discussed for context"""
        recent_messages = list(self.messages)[-10:]  # Last 10 messages
        
        return {
            'message_count': len(self.messages),
            'key_facts': self.key_facts,
            'recent_emotional_state': self.emotional_journey[-3:] if len(self.emotional_journey) >= 3 else self.emotional_journey,
            'main_topics': sorted(self.topics_discussed.items(), key=lambda x: x[1]['count'], reverse=True)[:5],
            'recent_context': [
                {
                    'content': msg['content'],
                    'is_user': msg['is_user'],
                    'timestamp': msg['timestamp']
                } for msg in recent_messages
            ]
        }

class MessageContentAnalyzer:
    """Analyzes message content to understand what user is actually talking about"""
    
    def __init__(self):
        self.temporal_patterns = {
            'immediate': ['right now', 'currently', 'at the moment', 'today'],
            'near_future': ['tomorrow', 'later today', 'this evening', 'in a few hours'],
            'future': ['next week', 'next month', 'in the future', 'eventually'],
            'past': ['yesterday', 'last week', 'before', 'earlier', 'previously']
        }
        
        self.anxiety_triggers = {
            'performance': ['presentation', 'speech', 'interview', 'test', 'exam', 'performance'],
            'social': ['meeting', 'date', 'party', 'social', 'people', 'crowd'],
            'work': ['deadline', 'boss', 'project', 'work', 'job', 'career'],
            'health': ['doctor', 'appointment', 'medical', 'health', 'surgery'],
            'relationship': ['fight', 'argument', 'breakup', 'relationship', 'partner']
        }
        
        self.emotional_qualifiers = {
            'intensity': {
                'mild': ['a bit', 'somewhat', 'kind of', 'slightly', 'a little'],
                'moderate': ['pretty', 'quite', 'fairly', 'rather'],
                'high': ['really', 'very', 'extremely', 'incredibly', 'totally', 'completely']
            },
            'urgency': {
                'low': ['eventually', 'sometime', 'maybe', 'perhaps'],
                'medium': ['soon', 'shortly', 'before long'],
                'high': ['immediately', 'right now', 'urgent', 'asap', 'emergency']
            }
        }
    
    def analyze_content(self, message: str, conversation_memory: ConversationMemory) -> Dict[str, Any]:
        """Deep analysis of what the user is actually talking about"""
        message_lower = message.lower()
        
        analysis = {
            'core_subject': self._identify_core_subject(message, conversation_memory),
            'emotional_context': self._analyze_emotional_context(message_lower),
            'temporal_context': self._identify_temporal_context(message_lower),
            'specificity_level': self._assess_specificity(message),
            'conversation_intent': self._identify_intent(message_lower),
            'referenced_entities': self._extract_entities(message),
            'anxiety_sources': self._identify_anxiety_sources(message_lower),
            'conversation_threading': self._identify_conversation_threads(message, conversation_memory)
        }
        
        return analysis
    
    def _identify_core_subject(self, message: str, memory: ConversationMemory) -> Dict[str, Any]:
        """Identify what they're primarily talking about"""
        message_lower = message.lower()
        
        # Look for explicit subjects
        subjects = {
            'event': re.findall(r'(?:my |the |this )?(presentation|meeting|interview|appointment|date|party|exam|test)', message_lower),
            'person': re.findall(r'(?:my |with )?(?:boss|manager|partner|friend|doctor|teacher|professor|coworker)', message_lower),
            'object': re.findall(r'(?:my |the |this )?(project|assignment|report|paper|proposal)', message_lower),
            'concept': re.findall(r'(?:the |this )?(situation|problem|issue|challenge|opportunity)', message_lower)
        }
        
        # Check for subjects mentioned previously in conversation
        previous_subjects = memory.key_facts.get('personal_subjects', [])
        referenced_previous = [subj for subj in previous_subjects if subj in message_lower]
        
        return {
            'primary_subjects': {k: v for k, v in subjects.items() if v},
            'referenced_previous_subjects': referenced_previous,
            'subject_specificity': 'specific' if any(subjects.values()) else 'general'
        }
    
    def _analyze_emotional_context(self, message_lower: str) -> Dict[str, Any]:
        """Analyze emotional context with nuance"""
        emotions = {
            'stress': ['stressed', 'overwhelmed', 'pressure', 'anxiety', 'worried', 'tense'],
            'fear': ['scared', 'afraid', 'terrified', 'nervous', 'anxious', 'worried'],
            'excitement': ['excited', 'thrilled', 'pumped', 'eager', 'enthusiastic'],
            'frustration': ['frustrated', 'annoyed', 'irritated', 'fed up', 'angry'],
            'sadness': ['sad', 'upset', 'down', 'disappointed', 'hurt', 'heartbroken'],
            'confusion': ['confused', 'lost', 'unclear', 'uncertain', 'mixed up'],
            'hope': ['hopeful', 'optimistic', 'positive', 'confident', 'encouraged']
        }
        
        detected_emotions = []
        intensity_level = 'medium'
        
        # Detect emotions
        for emotion_type, keywords in emotions.items():
            for keyword in keywords:
                if keyword in message_lower:
                    detected_emotions.append(emotion_type)
        
        # Assess intensity
        for level, qualifiers in self.emotional_qualifiers['intensity'].items():
            if any(qualifier in message_lower for qualifier in qualifiers):
                intensity_level = level
                break
        
        return {
            'emotions': detected_emotions,
            'intensity': intensity_level,
            'emotional_complexity': 'complex' if len(detected_emotions) > 1 else 'simple'
        }
    
    def _identify_temporal_context(self, message_lower: str) -> Dict[str, Any]:
        """Identify when things are happening"""
        temporal_context = {'timeframe': 'general', 'urgency': 'low', 'specific_times': []}
        
        for timeframe, patterns in self.temporal_patterns.items():
            if any(pattern in message_lower for pattern in patterns):
                temporal_context['timeframe'] = timeframe
                break
        
        # Look for specific times
        time_patterns = [
            r'at (\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)',
            r'(\d{1,2}(?::\d{2})\s*[ap]m)',
            r'(morning|afternoon|evening|night)',
            r'in (\d+)\s*(minutes?|hours?|days?)'
        ]
        
        for pattern in time_patterns:
            matches = re.findall(pattern, message_lower)
            temporal_context['specific_times'].extend(matches)
        
        # Assess urgency
        for urgency_level, indicators in self.emotional_qualifiers['urgency'].items():
            if any(indicator in message_lower for indicator in indicators):
                temporal_context['urgency'] = urgency_level
                break
        
        return temporal_context
    
    def _identify_anxiety_sources(self, message_lower: str) -> List[str]:
        """Identify what's causing anxiety/stress"""
        sources = []
        
        for source_type, keywords in self.anxiety_triggers.items():
            if any(keyword in message_lower for keyword in keywords):
                sources.append(source_type)
        
        return sources
    
    def _assess_specificity(self, message: str) -> str:
        """Assess how specific vs general their message is"""
        specific_indicators = len(re.findall(r'(?:my |the |this |that )', message.lower()))
        question_marks = message.count('?')
        concrete_nouns = len(re.findall(r'\b(?:presentation|meeting|project|deadline|appointment)\b', message.lower()))
        
        if concrete_nouns >= 2 or specific_indicators >= 3:
            return 'highly_specific'
        elif concrete_nouns >= 1 or specific_indicators >= 2:
            return 'moderately_specific'
        else:
            return 'general'
    
    def _identify_intent(self, message_lower: str) -> str:
        """Identify what they want from the conversation"""
        intent_patterns = {
            'seeking_advice': ['what should i', 'how do i', 'should i', 'what would you', 'advice', 'recommend'],
            'venting': ['can\'t believe', 'so frustrated', 'hate when', 'ugh', 'argh', 'need to vent'],
            'seeking_validation': ['am i', 'is it normal', 'does that make sense', 'is that okay'],
            'sharing_update': ['guess what', 'wanted to tell you', 'exciting news', 'update'],
            'processing_emotions': ['feeling', 'don\'t know how', 'confused about', 'mixed emotions'],
            'problem_solving': ['figure out', 'work through', 'solve', 'handle', 'deal with'],
            'seeking_support': ['going through', 'having a hard time', 'struggling', 'could use support']
        }
        
        for intent, patterns in intent_patterns.items():
            if any(pattern in message_lower for pattern in patterns):
                return intent
        
        return 'general_conversation'
    
    def _extract_entities(self, message: str) -> Dict[str, List[str]]:
        """Extract people, places, things mentioned"""
        entities = {
            'people': re.findall(r'(?:my |with )?(?:boss|manager|partner|boyfriend|girlfriend|husband|wife|friend|coworker|doctor|therapist)', message.lower()),
            'places': re.findall(r'(?:at |in |to )?(?:work|office|home|school|hospital|restaurant)', message.lower()),
            'events': re.findall(r'(?:the |my )?(?:meeting|presentation|interview|appointment|date|party|wedding|funeral)', message.lower())
        }
        
        return {k: list(set(v)) for k, v in entities.items() if v}
    
    def _identify_conversation_threads(self, message: str, memory: ConversationMemory) -> List[str]:
        """Identify connections to previous parts of conversation"""
        threads = []
        message_lower = message.lower()
        
        # Check for explicit references
        reference_words = ['that', 'this', 'it', 'like i said', 'remember when', 'you mentioned']
        if any(word in message_lower for word in reference_words):
            threads.append('explicit_reference')
        
        # Check for topic continuation
        recent_topics = set()
        for msg in list(memory.messages)[-5:]:  # Last 5 messages
            if msg.get('detected_topics'):
                recent_topics.update(msg['detected_topics'])
        
        current_topics = set(self._extract_basic_topics(message_lower))
        if recent_topics.intersection(current_topics):
            threads.append('topic_continuation')
        
        # Check for emotional continuation
        if memory.emotional_journey:
            last_emotions = memory.emotional_journey[-1]['emotions'] if memory.emotional_journey else []
            current_emotions = self._analyze_emotional_context(message_lower)['emotions']
            if any(emotion in [e.get('emotion', '') for e in last_emotions] for emotion in current_emotions):
                threads.append('emotional_continuation')
        
        return threads
    
    def _extract_basic_topics(self, message_lower: str) -> List[str]:
        """Basic topic extraction for threading analysis"""
        topics = []
        topic_keywords = {
            'work': ['work', 'job', 'office', 'boss', 'coworker', 'meeting', 'project'],
            'relationship': ['relationship', 'partner', 'boyfriend', 'girlfriend', 'dating'],
            'family': ['family', 'mom', 'dad', 'parents', 'sibling'],
            'health': ['health', 'doctor', 'medical', 'sick', 'therapy'],
            'education': ['school', 'college', 'class', 'teacher', 'study']
        }
        
        for topic, keywords in topic_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                topics.append(topic)
        
        return topics

class DynamicResponseBuilder:
    """Builds responses that directly address specific content"""
    
    def __init__(self):
        self.acknowledgment_templates = {
            'specific_event': [
                "Presentations can definitely ramp up the anxiety, especially when {temporal_context}",
                "Job interviews are nerve-wracking, particularly when {specific_aspect}",
                "Medical appointments can feel overwhelming, especially {emotional_qualifier}"
            ],
            'general_stress': [
                "That kind of pressure can really weigh on you",
                "It sounds like you're carrying a lot right now",
                "Those feelings of overwhelm are completely valid"
            ]
        }
        
        self.follow_up_patterns = {
            'anxiety_about_event': [
                "What's the part that's weighing on you most - {option1}, {option2}, or {option3}?",
                "Is it more about {specific_aspect} or the general {general_aspect}?",
                "What feels like the biggest challenge with {subject}?"
            ],
            'emotional_processing': [
                "How long have you been feeling this way about {subject}?",
                "What's making this feel particularly {emotion} right now?",
                "Is this similar to how you felt when {previous_reference}?"
            ]
        }
        
        self.context_connectors = [
            "Building on what you mentioned about {previous_topic}",
            "This reminds me of when you talked about {related_topic}",
            "I remember you saying {previous_point} - does this connect to that?"
        ]
    
    def build_response(self, analysis: Dict[str, Any], memory: ConversationMemory, original_message: str) -> str:
        """Build a dynamic response that addresses specific content"""
        
        response_parts = []
        
        # 1. Content-specific acknowledgment
        acknowledgment = self._build_acknowledgment(analysis, original_message)
        if acknowledgment:
            response_parts.append(acknowledgment)
        
        # 2. Emotional validation with context
        emotional_response = self._build_emotional_response(analysis)
        if emotional_response:
            response_parts.append(emotional_response)
        
        # 3. Context threading (reference previous conversation)
        context_thread = self._build_context_thread(analysis, memory)
        if context_thread:
            response_parts.append(context_thread)
        
        # 4. Specific follow-up based on content
        follow_up = self._build_follow_up(analysis, original_message)
        if follow_up:
            response_parts.append(follow_up)
        
        # 5. Natural transition or conclusion
        transition = self._build_transition(analysis, memory)
        if transition:
            response_parts.append(transition)
        
        return self._combine_response_parts(response_parts, analysis)
    
    def _build_acknowledgment(self, analysis: Dict[str, Any], message: str) -> str:
        """Build specific acknowledgment of what they're talking about"""
        
        core_subject = analysis['core_subject']
        temporal = analysis['temporal_context']
        emotional = analysis['emotional_context']
        
        # Handle specific events/subjects
        if core_subject['subject_specificity'] == 'specific':
            subjects = core_subject['primary_subjects']
            
            if 'event' in subjects and subjects['event']:
                event = subjects['event'][0]
                
                # Presentation-specific responses
                if event == 'presentation':
                    temporal_phrase = self._format_temporal_context(temporal)
                    return f"Presentations can definitely ramp up the anxiety{temporal_phrase}."
                
                # Interview-specific responses
                elif event == 'interview':
                    return f"Job interviews are nerve-wracking, especially with all the unknowns involved."
                
                # Meeting-specific responses
                elif event == 'meeting':
                    if emotional['emotions'] and 'stress' in emotional['emotions']:
                        return f"Work meetings can create a lot of pressure, especially important ones."
                
                # Generic event response
                else:
                    return f"Big events like {event}s can definitely stir up a lot of feelings."
            
            elif 'object' in subjects and subjects['object']:
                obj = subjects['object'][0]
                return f"Working on {obj}s can be really consuming, especially when there's a lot riding on them."
        
        # Handle emotional states without specific subjects
        if emotional['emotions']:
            primary_emotion = emotional['emotions'][0]
            intensity = emotional['intensity']
            
            intensity_modifiers = {
                'mild': 'those feelings of',
                'moderate': 'that sense of',
                'high': 'that intense feeling of'
            }
            
            modifier = intensity_modifiers.get(intensity, 'that feeling of')
            return f"I can really hear {modifier} {primary_emotion} in what you're sharing."
        
        return "I can sense there's a lot going on for you right now."
    
    def _format_temporal_context(self, temporal: Dict[str, Any]) -> str:
        """Format temporal context into natural language"""
        timeframe = temporal['timeframe']
        urgency = temporal['urgency']
        
        if timeframe == 'near_future':
            if urgency == 'high':
                return ', especially when tomorrow feels so close'
            else:
                return ', especially with tomorrow approaching'
        elif timeframe == 'immediate':
            return ', especially when you need to handle it right now'
        elif temporal['specific_times']:
            return f', especially with the timing at {temporal["specific_times"][0]}'
        else:
            return ''
    
    def _build_emotional_response(self, analysis: Dict[str, Any]) -> str:
        """Build response that validates emotions with context"""
        
        emotional = analysis['emotional_context']
        anxiety_sources = analysis['anxiety_sources']
        
        if not emotional['emotions']:
            return ""
        
        primary_emotion = emotional['emotions'][0]
        intensity = emotional['intensity']
        
        # Stress/anxiety with identified sources
        if primary_emotion in ['stress', 'anxiety'] and anxiety_sources:
            source = anxiety_sources[0]
            
            source_responses = {
                'performance': "Performance anxiety is so real - our minds can really spiral when we're thinking about being evaluated or judged.",
                'social': "Social situations can feel like there's so much pressure to get everything right.",
                'work': "Work stress hits different because it affects so many other parts of our lives.",
                'health': "Health concerns can be really scary because there's often so much unknown.",
            }
            
            return source_responses.get(source, "That kind of anxiety can feel really overwhelming.")
        
        # Complex emotions
        if emotional['emotional_complexity'] == 'complex':
            return "It sounds like you're experiencing a mix of emotions about this - that can make it feel even more intense."
        
        # High intensity emotions
        if intensity == 'high':
            emotion_responses = {
                'stress': "That level of stress can feel absolutely consuming.",
                'fear': "That kind of fear can be paralyzing - it's completely understandable.",
                'frustration': "That level of frustration is exhausting to carry.",
                'sadness': "That depth of sadness is really heavy to hold."
            }
            return emotion_responses.get(primary_emotion, f"That intense {primary_emotion} sounds really difficult to manage.")
        
        return ""
    
    def _build_context_thread(self, analysis: Dict[str, Any], memory: ConversationMemory) -> str:
        """Reference previous parts of conversation"""
        
        threads = analysis['conversation_threading']
        memory_summary = memory.get_memory_summary()
        
        if not threads or not memory_summary['recent_context']:
            return ""
        
        # Topic continuation
        if 'topic_continuation' in threads:
            main_topics = memory_summary['main_topics']
            if main_topics:
                most_discussed = main_topics[0][0]  # Topic name
                return f"This sounds connected to what we've been discussing about {most_discussed}."
        
        # Emotional continuation
        if 'emotional_continuation' in threads and memory_summary['recent_emotional_state']:
            last_emotion_data = memory_summary['recent_emotional_state'][-1]
            if last_emotion_data['emotions']:
                last_emotion = last_emotion_data['emotions'][0].get('emotion', '')
                return f"I can see this is continuing from those {last_emotion} feelings you mentioned."
        
        # Explicit reference
        if 'explicit_reference' in threads:
            return "I remember what you were saying about that."
        
        return ""
    
    def _build_follow_up(self, analysis: Dict[str, Any], message: str) -> str:
        """Build specific follow-up questions based on content"""
        
        intent = analysis['conversation_intent']
        core_subject = analysis['core_subject']
        anxiety_sources = analysis['anxiety_sources']
        
        # Advice-seeking gets problem-focused questions
        if intent == 'seeking_advice':
            subjects = core_subject['primary_subjects']
            if 'event' in subjects and subjects['event']:
                event = subjects['event'][0]
                if event == 'presentation':
                    return "What's the part that's weighing on you most - the content, the audience, or just the general performance pressure?"
                elif event == 'interview':
                    return "Is it more the interview questions you're worried about, or the general impression you'll make?"
                elif event == 'meeting':
                    return "What feels like the biggest challenge - what you need to present, or how it might be received?"
            return "What aspect of this feels most important to figure out?"
        
        # Venting gets validation + gentle exploration
        elif intent == 'venting':
            return "What's been the most frustrating part about dealing with this?"
        
        # Emotional processing gets deeper questions
        elif intent == 'processing_emotions':
            if anxiety_sources:
                source = anxiety_sources[0]
                if source == 'performance':
                    return "Have you had similar performance anxiety before, or does this feel different?"
                elif source == 'work':
                    return "How long has work been feeling this stressful?"
            return "What do you think is making this feel particularly intense right now?"
        
        # Problem-solving gets structured questions
        elif intent == 'problem_solving':
            return "What feels like the first step in untangling this?"
        
        # General gets open exploration
        return "What's been on your mind most about this?"
    
    def _build_transition(self, analysis: Dict[str, Any], memory: ConversationMemory) -> str:
        """Build natural transitions or conclusions"""
        
        # Don't always need transitions - sometimes less is more
        if random.random() < 0.7:  # 70% chance to skip transition
            return ""
        
        intent = analysis['conversation_intent']
        
        supportive_transitions = [
            "I'm here to work through this with you.",
            "Take your time - there's no rush to figure it all out at once.",
            "These feelings make complete sense given what you're dealing with."
        ]
        
        if intent in ['seeking_support', 'processing_emotions', 'venting']:
            return random.choice(supportive_transitions)
        
        return ""
    
    def _combine_response_parts(self, parts: List[str], analysis: Dict[str, Any]) -> str:
        """Combine response parts into flowing, natural conversation"""
        
        if not parts:
            return "I'm listening. Tell me more about what's going through your mind."
        
        # Filter out empty parts
        parts = [part.strip() for part in parts if part and part.strip()]
        
        if len(parts) == 1:
            return parts[0]
        
        elif len(parts) == 2:
            # Simple combination
            return f"{parts[0]} {parts[1]}"
        
        else:
            # More complex combination with natural flow
            main_response = f"{parts[0]} {parts[1]}"
            
            # Add follow-up with natural connector
            if len(parts) >= 3:
                follow_up = parts[2]
                
                # Choose connector based on intent
                intent = analysis['conversation_intent']
                if intent in ['seeking_advice', 'problem_solving']:
                    connector = " So, "
                elif intent in ['venting', 'processing_emotions']:
                    connector = " "
                else:
                    connector = " "
                
                main_response += f"{connector}{follow_up}"
            
            # Add any additional parts
            if len(parts) > 3:
                main_response += f" {' '.join(parts[3:])}"
            
            return main_response

class ConversationalAIService:
    """Main service that orchestrates enhanced conversational abilities"""
    
    def __init__(self):
        self.memory = ConversationMemory()
        self.analyzer = MessageContentAnalyzer()
        self.response_builder = DynamicResponseBuilder()
        
        # Enhanced conversation capabilities
        self.conversation_patterns = {
            'user_communication_style': 'adaptive',  # Will learn user's style
            'response_personality': {
                'empathy_level': 0.9,
                'curiosity_level': 0.8,
                'supportiveness': 0.9,
                'directness': 0.6,
                'humor_appropriateness': 0.3
            }
        }
    
    async def process_message(
        self, 
        message: str, 
        user_id: int = 1,
        conversation_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Main method to process message and generate enhanced response"""
        
        # Check if we need to start a new chat due to memory overload
        should_restart, restart_reason = self.memory.should_start_new_chat()
        if should_restart:
            return self._handle_memory_overflow(restart_reason)
        
        # Add message to memory
        message_data = {
            'content': message,
            'is_user': True,
            'timestamp': datetime.now(),
            'detected_emotions': [],  # Will be filled by analysis
            'detected_topics': []     # Will be filled by analysis
        }
        
        # Deep content analysis
        analysis = self.analyzer.analyze_content(message, self.memory)
        
        # Add analysis results to message data
        message_data['detected_emotions'] = [
            {'emotion': emotion, 'intensity': analysis['emotional_context']['intensity'], 'score': 0.8}
            for emotion in analysis['emotional_context']['emotions']
        ]
        message_data['detected_topics'] = self._extract_topics_from_analysis(analysis)
        
        # Add to memory
        self.memory.add_message(message_data)
        
        # Build dynamic response
        response = self.response_builder.build_response(analysis, self.memory, message)
        
        # Create AI response data
        ai_response_data = {
            'content': response,
            'is_user': False,
            'timestamp': datetime.now(),
            'detected_emotions': [],
            'detected_topics': message_data['detected_topics']
        }
        
        # Add AI response to memory
        self.memory.add_message(ai_response_data)
        
        # Calculate additional metrics
        sentiment_score = self._calculate_sentiment_score(analysis)
        
        return {
            'response': response,
            'detected_emotions': message_data['detected_emotions'],
            'detected_topics': message_data['detected_topics'],
            'intent': analysis['conversation_intent'],
            'sentiment_score': sentiment_score,
            'conversation_analysis': analysis,
            'memory_status': {
                'message_count': len(self.memory.messages),
                'memory_usage': f"{len(self.memory.messages)}/{self.memory.max_messages}",
                'topics_tracked': len(self.memory.topics_discussed),
                'key_facts_learned': len(self.memory.key_facts)
            },
            'new_user_facts': self._extract_user_facts_from_analysis(analysis, message),
            'response_metadata': {
                'response_type': 'enhanced_conversational',
                'content_specificity': analysis['specificity_level'],
                'conversation_threading': analysis['conversation_threading']
            }
        }
    
    def _handle_memory_overflow(self, reason: str) -> Dict[str, Any]:
        """Handle when conversation memory is overloaded"""
        
        memory_summary = self.memory.get_memory_summary()
        
        overflow_messages = {
            'conversation_length': f"We've had such a rich conversation with {memory_summary['message_count']} messages! I think it would be good to start a fresh chat so I can give you my full attention on new topics. Would you like to start a new conversation?",
            'context_length': "Our conversation has become really deep and detailed! To make sure I can respond thoughtfully to what you're sharing, let's start a new chat. I'll remember our main themes, but a fresh start will help me focus better.",
            'topic_overload': f"We've covered so many different topics ({len(memory_summary['main_topics'])} main ones!) - you have such a rich inner world! Let's start a new conversation so I can give proper attention to whatever's on your mind next."
        }
        
        return {
            'response': overflow_messages.get(reason, "Let's start a new conversation to keep our chat focused and meaningful."),
            'memory_overflow': True,
            'restart_required': True,
            'conversation_summary': memory_summary,
            'overflow_reason': reason
        }
    
    def _extract_topics_from_analysis(self, analysis: Dict[str, Any]) -> List[str]:
        """Extract topics from content analysis"""
        topics = []
        
        # From core subjects
        core_subject = analysis['core_subject']
        if core_subject['primary_subjects']:
            for subject_type, subjects in core_subject['primary_subjects'].items():
                topics.extend(subjects)
        
        # From anxiety sources
        topics.extend(analysis['anxiety_sources'])
        
        # From entities
        entities = analysis['referenced_entities']
        for entity_type, entity_list in entities.items():
            topics.extend(entity_list)
        
        return list(set(topics))  # Remove duplicates
    
    def _calculate_sentiment_score(self, analysis: Dict[str, Any]) -> float:
        """Calculate sentiment score from analysis"""
        emotional_context = analysis['emotional_context']
        emotions = emotional_context['emotions']
        intensity = emotional_context['intensity']
        
        if not emotions:
            return 0.0
        
        # Emotion valence mapping
        emotion_valence = {
            'excitement': 0.8, 'hope': 0.7, 'happiness': 0.8,
            'stress': -0.6, 'anxiety': -0.5, 'fear': -0.7,
            'frustration': -0.6, 'sadness': -0.8, 'confusion': -0.3
        }
        
        # Intensity multipliers
        intensity_multiplier = {'mild': 0.5, 'moderate': 1.0, 'high': 1.5}.get(intensity, 1.0)
        
        # Calculate weighted average
        total_valence = sum(emotion_valence.get(emotion, 0) for emotion in emotions)
        avg_valence = total_valence / len(emotions) if emotions else 0
        
        return max(-1.0, min(1.0, avg_valence * intensity_multiplier))
    
    def _extract_user_facts_from_analysis(self, analysis: Dict[str, Any], message: str) -> List[Dict[str, Any]]:
        """Extract user facts from message analysis"""
        facts = []
        
        # Extract from entities
        entities = analysis['referenced_entities']
        
        # Work-related facts
        if 'people' in entities:
            for person in entities['people']:
                if person in ['boss', 'manager']:
                    facts.append({
                        'fact_type': 'work_context',
                        'key': 'has_supervisor',
                        'value': person,
                        'confidence': 0.8
                    })
                elif person in ['partner', 'boyfriend', 'girlfriend', 'husband', 'wife']:
                    facts.append({
                        'fact_type': 'relationship_status',
                        'key': 'relationship_type',
                        'value': person,
                        'confidence': 0.9
                    })
        
        # Event-related facts
        core_subject = analysis['core_subject']
        if core_subject['primary_subjects'].get('event'):
            event = core_subject['primary_subjects']['event'][0]
            temporal = analysis['temporal_context']
            
            if temporal['timeframe'] in ['near_future', 'immediate']:
                facts.append({
                    'fact_type': 'upcoming_event',
                    'key': f'upcoming_{event}',
                    'value': temporal['timeframe'],
                    'confidence': 0.9
                })
        
        # Anxiety patterns
        if analysis['anxiety_sources']:
            for source in analysis['anxiety_sources']:
                facts.append({
                    'fact_type': 'stress_pattern',
                    'key': f'anxiety_about_{source}',
                    'value': 'true',
                    'confidence': 0.7
                })
        
        return facts
    
    def get_conversation_insights(self) -> Dict[str, Any]:
        """Get insights about the current conversation"""
        memory_summary = self.memory.get_memory_summary()
        
        return {
            'conversation_health': self._assess_conversation_health(),
            'user_patterns': self._analyze_user_patterns(),
            'emotional_journey': self._analyze_emotional_journey(),
            'topic_evolution': self._analyze_topic_evolution(),
            'memory_summary': memory_summary
        }
    
    def _assess_conversation_health(self) -> Dict[str, Any]:
        """Assess how well the conversation is flowing"""
        messages = list(self.memory.messages)
        
        # Calculate engagement metrics
        user_messages = [msg for msg in messages if msg['is_user']]
        avg_message_length = sum(len(msg['content']) for msg in user_messages) / len(user_messages) if user_messages else 0
        
        # Topic diversity
        topic_diversity = len(self.memory.topics_discussed)
        
        # Emotional variety
        all_emotions = []
        for emotion_data in self.memory.emotional_journey:
            all_emotions.extend([e.get('emotion', '') for e in emotion_data['emotions']])
        emotional_variety = len(set(all_emotions))
        
        return {
            'engagement_level': 'high' if avg_message_length > 50 else 'medium' if avg_message_length > 20 else 'low',
            'topic_diversity': 'high' if topic_diversity > 5 else 'medium' if topic_diversity > 2 else 'low',
            'emotional_openness': 'high' if emotional_variety > 3 else 'medium' if emotional_variety > 1 else 'low',
            'conversation_depth': 'deep' if len(messages) > 20 else 'moderate' if len(messages) > 10 else 'surface'
        }
    
    def _analyze_user_patterns(self) -> Dict[str, Any]:
        """Analyze patterns in how the user communicates"""
        messages = [msg for msg in self.memory.messages if msg['is_user']]
        
        if not messages:
            return {}
        
        # Communication style analysis
        avg_length = sum(len(msg['content']) for msg in messages) / len(messages)
        question_ratio = sum(1 for msg in messages if '?' in msg['content']) / len(messages)
        
        # Emotional expression patterns
        emotional_messages = sum(1 for msg in messages if msg.get('detected_emotions'))
        emotional_ratio = emotional_messages / len(messages) if messages else 0
        
        return {
            'communication_style': 'detailed' if avg_length > 100 else 'concise' if avg_length < 30 else 'moderate',
            'question_tendency': 'high' if question_ratio > 0.4 else 'moderate' if question_ratio > 0.2 else 'low',
            'emotional_expression': 'very_open' if emotional_ratio > 0.7 else 'somewhat_open' if emotional_ratio > 0.4 else 'reserved',
            'preferred_topics': [topic for topic, data in sorted(self.memory.topics_discussed.items(), key=lambda x: x[1]['count'], reverse=True)[:3]]
        }
    
    def _analyze_emotional_journey(self) -> Dict[str, Any]:
        """Analyze how emotions have evolved through conversation"""
        if not self.memory.emotional_journey:
            return {'pattern': 'no_emotional_data'}
        
        # Track emotional progression
        emotion_progression = []
        for emotion_data in self.memory.emotional_journey:
            primary_emotions = [e.get('emotion', '') for e in emotion_data['emotions'][:2]]  # Top 2 emotions
            emotion_progression.append(primary_emotions)
        
        # Identify patterns
        if len(emotion_progression) >= 3:
            start_emotions = set(emotion_progression[0])
            recent_emotions = set(emotion_progression[-1])
            
            # Check for improvement
            positive_emotions = {'excitement', 'hope', 'happiness', 'relief'}
            negative_emotions = {'stress', 'anxiety', 'fear', 'frustration', 'sadness'}
            
            start_negative = bool(start_emotions.intersection(negative_emotions))
            recent_positive = bool(recent_emotions.intersection(positive_emotions))
            
            if start_negative and recent_positive:
                pattern = 'improving'
            elif not start_negative and not recent_positive:
                pattern = 'declining'
            else:
                pattern = 'stable'
        else:
            pattern = 'too_early'
        
        return {
            'pattern': pattern,
            'emotion_variety': len(set(emotion for emotions in emotion_progression for emotion in emotions)),
            'progression': emotion_progression[-5:] if len(emotion_progression) >= 5 else emotion_progression  # Last 5
        }
    
    def _analyze_topic_evolution(self) -> Dict[str, Any]:
        """Analyze how topics have evolved through conversation"""
        topics_by_time = []
        
        for msg in list(self.memory.messages):
            if msg['is_user'] and msg.get('detected_topics'):
                topics_by_time.append({
                    'timestamp': msg['timestamp'],
                    'topics': msg['detected_topics']
                })
        
        if not topics_by_time:
            return {'evolution': 'no_topics'}
        
        # Analyze topic progression
        all_topics = set()
        topic_introduction_order = []
        
        for entry in topics_by_time:
            for topic in entry['topics']:
                if topic not in all_topics:
                    all_topics.add(topic)
                    topic_introduction_order.append(topic)
        
        # Check for topic focus vs breadth
        unique_topics = len(all_topics)
        total_topic_mentions = sum(len(entry['topics']) for entry in topics_by_time)
        
        focus_ratio = total_topic_mentions / unique_topics if unique_topics > 0 else 0
        
        return {
            'evolution': 'focused' if focus_ratio > 3 else 'exploratory' if unique_topics > 5 else 'balanced',
            'topic_introduction_order': topic_introduction_order,
            'most_discussed': max(self.memory.topics_discussed.items(), key=lambda x: x[1]['count'])[0] if self.memory.topics_discussed else None,
            'topic_count': unique_topics
        }
    
    def reset_conversation(self, preserve_user_facts: bool = True) -> Dict[str, Any]:
        """Reset conversation memory for new chat"""
        # Get summary before reset
        final_summary = self.memory.get_memory_summary()
        
        # Preserve important user facts if requested
        preserved_facts = self.memory.key_facts.copy() if preserve_user_facts else {}
        
        # Reset memory
        self.memory = ConversationMemory()
        
        # Restore preserved facts
        if preserved_facts:
            self.memory.key_facts.update(preserved_facts)
        
        return {
            'reset_successful': True,
            'previous_conversation_summary': final_summary,
            'preserved_facts': preserved_facts
        }

# Example usage and testing
async def test_enhanced_conversation():
    """Test the enhanced conversational capabilities"""
    
    ai = ConversationalAIService()
    
    # Test messages that demonstrate the improvements
    test_messages = [
        "I'm stressed about my presentation tomorrow",
        "Yeah, it's a big client meeting and I'm worried about the technical demo",
        "The slides look good but I'm nervous about the Q&A section",
        "What if they ask something I don't know?",
        "I guess I should prepare some backup answers",
        "Thanks, that helps. Actually, this reminds me of my job interview last month"
    ]
    
    print("=== Enhanced Conversational AI Test ===\n")
    
    for i, message in enumerate(test_messages, 1):
        print(f"User {i}: {message}")
        
        result = await ai.process_message(message)
        
        print(f"AI {i}: {result['response']}")
        print(f"Analysis: Intent={result['intent']}, Topics={result['detected_topics']}")
        print(f"Memory: {result['memory_status']['message_count']} messages, {result['memory_status']['topics_tracked']} topics tracked")
        print()
        
        # Check for memory overflow
        if result.get('memory_overflow'):
            print("🔄 MEMORY OVERFLOW - Starting new chat")
            break
    
    # Show conversation insights
    insights = ai.get_conversation_insights()
    print("=== Conversation Insights ===")
    print(f"Health: {insights['conversation_health']}")
    print(f"User Patterns: {insights['user_patterns']}")
    print(f"Emotional Journey: {insights['emotional_journey']}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_enhanced_conversation())