emotion = EmotionEngine()
personality = PersonalityEvolution()
memory = CompanionMemory()
behavior = BehaviorEngine()

brain = CompanionBrain(llm=openai_service)

while True:

    user_text = input("User: ")

    emotion.update_from_user(user_text)
    memory.log_emotion(emotion.state)

    response = brain.think(user_text, memory, emotion, personality)

    mode = behavior.decide(emotion, personality)

    print("AI:", response)
    print("MODE:", mode)
