class TheoryOfMind:

    def infer_user_state(self, text, memory):

        state = {
            "belief": "unknown",
            "emotion": "neutral",
            "intent": "unknown"
        }

        text = text.lower()

        # emotion inference
        if "sad" in text:
            state["emotion"] = "sad"
        elif "happy" in text:
            state["emotion"] = "happy"

        # intent inference
        if "why" in text:
            state["intent"] = "seeking_explanation"

        if "help" in text:
            state["intent"] = "request_support"

        # belief inference (simple heuristic)
        if "i think" in text:
            state["belief"] = "uncertain_model"

        return state
