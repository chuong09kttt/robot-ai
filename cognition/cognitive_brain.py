class CognitiveBrain:

    def decide(self, user_text, perception, location):

        text = user_text.lower()

        if "room 101" in text:
            return {"action": "go_to", "target": "room_101"}

        if "reception" in text:
            return {"action": "go_to", "target": "reception"}

        if "follow me" in text:
            return {"action": "follow_user"}

        return {"action": "chat"}
