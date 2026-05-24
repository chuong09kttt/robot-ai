class AdaptiveBehavior:

    def get_mode(self, environment):

        if environment == "hotel":
            return {
                "tone": "polite_service",
                "behavior": "guide_guest"
            }

        if environment == "office":
            return {
                "tone": "professional",
                "behavior": "assistant_meeting"
            }

        if environment == "restaurant":
            return {
                "tone": "friendly_service",
                "behavior": "order_assist"
            }

        if environment == "home":
            return {
                "tone": "casual",
                "behavior": "personal_assistant"
            }

        return {
            "tone": "neutral",
            "behavior": "chat"
        }
