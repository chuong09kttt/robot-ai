class CognitiveAgent:

    def decide(self, vision, world, hazard, text):

        # SAFETY FIRST
        if hazard["risk_level"] > 0:
            return {
                "mode": "emergency",
                "action": "alert_human"
            }

        # CONTEXTUAL ROLES

        env = world

        if env == "factory":
            return {
                "mode": "safety_inspector",
                "action": "monitor_workers"
            }

        if env == "office":
            return {
                "mode": "manager_assistant",
                "action": "organize_tasks"
            }

        if env == "hotel":
            return {
                "mode": "service_robot",
                "action": "guide_guest"
            }

        return {
            "mode": "assistant",
            "action": "chat"
        }
