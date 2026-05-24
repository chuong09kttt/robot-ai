class HazardEngine:

    def evaluate(self, vision):

        alerts = []

        if vision.get("fire_detected"):
            alerts.append("🔥 FIRE ALERT")

        if vision.get("smoke_detected"):
            alerts.append("💨 SMOKE DETECTED")

        if not vision.get("helmet"):
            alerts.append("⚠️ NO HELMET DETECTED")

        if not vision.get("safety_vest"):
            alerts.append("⚠️ NO SAFETY VEST")

        return {
            "risk_level": len(alerts),
            "alerts": alerts
        }
