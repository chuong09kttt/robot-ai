class ContinualMemory:

    def __init__(self):
        self.memory = []
        self.weights = {}

    def learn(self, event):

        self.memory.append(event)

        key = event.get("type", "unknown")
        self.weights[key] = self.weights.get(key, 0) + 1

    def get_bias(self):

        return sorted(self.weights.items(), key=lambda x: -x[1])
