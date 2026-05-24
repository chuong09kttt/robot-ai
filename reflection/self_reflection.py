class SelfReflection:

    def evaluate(self, user_input, response):

        score = 1.0

        if len(response) < 20:
            score -= 0.3

        if "error" in response.lower():
            score -= 0.5

        return {
            "quality_score": score,
            "needs_improvement": score < 0.6
        }

    def improve_prompt(self, base_prompt, reflection):

        if reflection["needs_improvement"]:
            return base_prompt + "\nBe more clear and empathetic."

        return base_prompt
