class BehaviorEngine:

    def decide(self, emotion, personality):

        emo = emotion.get_dominant_emotion()

        if emo == "sadness":
            return "comfort_mode"

        if emo == "curiosity":
            return "teacher_mode"

        if personality.traits["humor"] > 0.7:
            return "friendly_mode"

        return "normal_mode"
