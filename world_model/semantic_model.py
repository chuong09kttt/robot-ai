class SemanticWorldModel:

    def classify_environment(self, vision, text):

        if "machine" in str(vision.get("risk_objects")):
            return "factory"

        if "room" in text:
            return "hotel"

        if "meeting" in text:
            return "office"

        return "general"
