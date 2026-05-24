emotion = EmotionEngine()
personality = PersonalityEvolution()
memory = CompanionMemory()
behavior = BehaviorEngine()

brain = CompanionBrain(llm=openai_service)


tom = TheoryOfMind()
reflection = SelfReflection()
memory = EpisodicMemory()
world_model = WorldModel()
brain = ConsciousBrain(llm=openai_service)




while True:

    user_text = input("User: ")
    
    memory.add_event(user_text)
    response = brain.think(
        user_text,
        tom,
        memory,
        world_model,
        reflection
    )

    eval_result = reflection.evaluate(user_text, response)

    if eval_result["needs_improvement"]:
        print("🔧 AI self-correcting behavior...")

    print("AI:", response)



    emotion.update_from_user(user_text)
    memory.log_emotion(emotion.state)

    response = brain.think(user_text, memory, emotion, personality)

    mode = behavior.decide(emotion, personality)

    print("AI:", response)
    print("MODE:", mode)
