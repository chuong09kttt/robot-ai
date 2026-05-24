class RealTimeVision:

    def analyze(self, frame):

        return {
            "people": True,
            "helmet": False,
            "safety_vest": False,
            "fire_detected": False,
            "smoke_detected": False,
            "risk_objects": ["open_machine"],
            "confidence": 0.87
        }
