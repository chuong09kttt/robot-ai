class CompanionMemory:

    def __init__(self):
        self.user_profile = {}
        self.emotional_history = []

    def remember_user(self, key, value):
        self.user_profile[key] = value

    def log_emotion(self, emotion_state):
        self.emotional_history.append(emotion_state)

    def recall(self, key):
        return self.user_profile.get(key, "unknown")
