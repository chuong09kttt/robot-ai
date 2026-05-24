class PerceptionSystem:

    def analyze(self, frame):

        return {
            "people_detected": True,
            "face": "known_user",
            "emotion": "neutral",
            "objects": ["cup", "table"]
        }
