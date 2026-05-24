class EnvironmentDetector:

    def classify(self, user_text, vision_data):

        text = user_text.lower() if user_text else ""

        score = {
            "hotel": 0,
            "office": 0,
            "restaurant": 0,
            "home": 0
        }

        # TEXT SIGNALS
        if "check in" in text or "room" in text:
            score["hotel"] += 0.7

        if "meeting" in text or "report" in text:
            score["office"] += 0.7

        if "menu" in text or "order" in text:
            score["restaurant"] += 0.7

        if "help me" in text or "turn on tv" in text:
            score["home"] += 0.5

        # VISION SIGNALS (giả lập)
        if vision_data:
            if vision_data.get("people_density", 0) > 10:
                score["office"] += 0.3

        # pick max
        context = max(score, key=score.get)

        return {
            "environment": context,
            "confidence": score[context]
        }
