class PersonalityEvolution:

    def __init__(self):
        self.traits = {
            "friendliness": 0.7,
            "strictness": 0.3,
            "humor": 0.5,
            "curiosity": 0.8
        }

    def learn_from_feedback(self, feedback):

        if feedback == "like":
            self.traits["friendliness"] += 0.05
            self.traits["humor"] += 0.02

        if feedback == "dislike":
            self.traits["strictness"] += 0.05
            self.traits["friendliness"] -= 0.05

        self.clamp()

    def clamp(self):

        for k in self.traits:
            self.traits[k] = max(0, min(1, self.traits[k]))

    def get_personality_prompt(self):

        return f"""
You are an AI companion with traits:
- friendliness: {self.traits['friendliness']}
- humor: {self.traits['humor']}
- strictness: {self.traits['strictness']}
Respond accordingly in tone.
"""
