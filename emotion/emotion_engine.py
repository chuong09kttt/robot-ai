class EmotionEngine:

    def __init__(self):
        self.state = {
            "happiness": 0.5,
            "sadness": 0.0,
            "curiosity": 0.7,
            "stress": 0.0
        }

    def update_from_user(self, text):

        text = text.lower()

        if "thank" in text or "good" in text:
            self.state["happiness"] += 0.1

        if "angry" in text or "bad" in text:
            self.state["stress"] += 0.2
            self.state["happiness"] -= 0.1

        if "why" in text or "how" in text:
            self.state["curiosity"] += 0.1

        self.normalize()

    def normalize(self):

        for k in self.state:
            self.state[k] = max(0.0, min(1.0, self.state[k]))

    def get_dominant_emotion(self):

        return max(self.state, key=self.state.get)
