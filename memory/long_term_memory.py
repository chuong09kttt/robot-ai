class LongTermMemory:

    def __init__(self):
        self.user_profile = {}
        self.events = []

    def store_fact(self, key, value):
        self.user_profile[key] = value

    def add_event(self, event):
        self.events.append(event)

    def recall(self, query):
        return self.user_profile.get(query, None)
