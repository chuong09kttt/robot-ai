class BehaviorEngine:

    def decide(self, emotion, context):

        if emotion == "sad":
            return "support_mode"

        if context.get("user_question_complex"):
            return "professor_mode"

        return "assistant_mode"
