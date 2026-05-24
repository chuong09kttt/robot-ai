class EpisodicMemory:

    def __init__(self):
        self.timeline = []

    def add_event(self, event):

        self.timeline.append({
            "event": event,
            "timestamp": len(self.timeline)
        })

    def get_recent(self, n=5):
        return self.timeline[-n:]
