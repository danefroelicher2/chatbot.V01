import asyncio
from typing import List, Dict, Any
import random

class AIService:
    """AI service for generating responses. Will be enhanced with real AI later."""
    
    def __init__(self):
        self.responses = [
            "That's really interesting! Can you tell me more about that?",
            "I understand. How does that make you feel?",
            "That reminds me of something we talked about earlier. What's your take on it?",
            "I'm curious about your perspective on this.",
            "That's a great point. What led you to think about it that way?",
            "Thanks for sharing that with me. What would you like to explore next?"
        ]
    
    async def generate_response(
        self, 
        message: str, 
        conversation_history: List[Dict[str, Any]] = None,
        user_facts: Dict[str, str] = None
    ) -> str:
        """Generate AI response based on message and context"""
        
        # Simulate AI processing time
        await asyncio.sleep(0.5)
        
        # Simple response logic for now (will be replaced with real AI)
        if any(word in message.lower() for word in ['hello', 'hi', 'hey']):
            return "Hello! It's great to hear from you. How are you doing today?"
        
        if any(word in message.lower() for word in ['how', 'why', 'what', 'when', 'where']):
            return "That's a thoughtful question. " + random.choice(self.responses)
        
        if any(word in message.lower() for word in ['sad', 'upset', 'angry', 'frustrated']):
            return "I can hear that you're going through something difficult. Would you like to talk about what's bothering you?"
        
        if any(word in message.lower() for word in ['happy', 'excited', 'great', 'awesome']):
            return "That's wonderful to hear! I love seeing you in good spirits. What's making you feel so positive?"
        
        # Default response with some personalization if we have user facts
        response = random.choice(self.responses)
        if user_facts and len(user_facts) > 0:
            response += f" I remember you mentioned you're interested in {list(user_facts.keys())[0]}."
        
        return response