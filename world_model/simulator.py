class WorldModel:

    def predict(self, state, action):

        if "sad" in state.get("emotion", ""):
            return "user may need emotional support"

        if action == "teach":
            return "user will learn new concept"

        return "stable interaction predicted"
