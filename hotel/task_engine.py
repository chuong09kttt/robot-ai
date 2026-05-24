class HotelTaskEngine:

    def decide_task(self, user_text, face_data):

        text = user_text.lower()

        if face_data.get("known"):

            if "room" in text:
                return {
                    "action": "escort",
                    "target": text
                }

        if "check in" in text:
            return {
                "action": "guide_reception"
            }

        if "deliver" in text:
            return {
                "action": "delivery_service"
            }

        return {"action": "chat"}
