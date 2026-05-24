class SocialAIBrain:

    def __init__(self):
        self.personality = {
            "friendliness": 0.8,
            "curiosity": 0.9,
            "formality": 0.4
        }

        self.emotion = "neutral"

    def think(self, input_text, memory, vision_state):

        context = self.build_context(memory, vision_state)

        if "sad" in input_text:
            self.emotion = "empathetic"
            return "Mình cảm nhận bạn đang không ổn. Bạn muốn chia sẻ không?"

        if "teach" in input_text:
            return "Mình sẽ giải thích theo cách dễ hiểu nhé."

        return self.general_response(input_text, context)

    def general_response(self, text, context):

        return f"Dựa trên thông tin mình biết: {text} - mình nghĩ rằng..."
