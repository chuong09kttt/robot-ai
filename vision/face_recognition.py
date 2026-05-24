import face_recognition

class FaceRecognition:

    def identify(self, frame):

        faces = face_recognition.face_encodings(frame)

        if len(faces) > 0:
            return {
                "known": True,
                "user_id": "guest_101",
                "confidence": 0.92
            }

        return {"known": False}
