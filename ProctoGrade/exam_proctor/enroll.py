import os
import cv2
import numpy as np
from datetime import datetime
from db_connect import get_db
import sounddevice as sd
from scipy.io.wavfile import write as wav_write
from resemblyzer import VoiceEncoder, preprocess_wav

# InsightFace — face detection + embedding
from insightface.app import FaceAnalysis

# ─────────────────────────────────────────────
#  MODELS LOAD
# ─────────────────────────────────────────────
print("Loading InsightFace model...")
face_app = FaceAnalysis(
    name="buffalo_sc",
    providers=["CPUExecutionProvider"]
)
face_app.prepare(ctx_id=-1, det_size=(640, 640))
print("InsightFace loaded!")

# ─────────────────────────────────────────────
#  STUDENT INFO
# ─────────────────────────────────────────────
def capture_student_info():
    student_id   = input("Enter Student ID: ").strip()
    student_name = input("Enter Student Name: ").strip()
    if not student_id or not student_name:
        print("Student ID and Name cannot be empty!")
        return None, None
    return student_id, student_name

# ─────────────────────────────────────────────
#  FACE ENROLLMENT — 5 ANGLES
# ─────────────────────────────────────────────
ANGLE_INSTRUCTIONS = [
    "Look STRAIGHT at the camera",
    "Turn head slightly LEFT",
    "Turn head slightly RIGHT",
    "Tilt head slightly UP",
    "Tilt head slightly DOWN",
]

def capture_images(student_folder):
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Camera could not be opened.")
        return None

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cv2.namedWindow("Enroll Student", cv2.WINDOW_NORMAL)

    ref_images = []
    count      = 0

    print("\nFace Enrollment: 5 angles capture honge.")
    print("Press 'S' to capture each angle, 'Q' to cancel.\n")

    while count < 5:
        ret, frame = cap.read()
        if not ret:
            continue

        instruction = ANGLE_INSTRUCTIONS[count]
        rgb         = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces       = face_app.get(rgb)
        display     = frame.copy()

        for face in faces:
            box = face.bbox.astype(int)
            cv2.rectangle(display, (box[0], box[1]), (box[2], box[3]), (0, 220, 100), 2)

        cv2.putText(display, f"Step {count+1}/5: {instruction}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 220, 255), 2)
        cv2.putText(display, "Press 'S' to capture",
                    (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

        if len(faces) == 0:
            cv2.putText(display, "No face detected — adjust position",
                        (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)
        elif len(faces) > 1:
            cv2.putText(display, "Multiple faces — only student should be visible",
                        (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)

        cv2.imshow("Enroll Student", display)
        key = cv2.waitKey(1)

        if key & 0xFF == ord('s'):
            if len(faces) == 0:
                print("No face detected! Try again.")
                continue
            if len(faces) > 1:
                print("Multiple faces detected! Only student should be visible.")
                continue
            file_path = os.path.join(student_folder, f"reference_image_{count+1}.jpg")
            cv2.imwrite(file_path, frame)
            ref_images.append(frame.copy())
            count += 1
            print(f"Angle {count}/5 captured: {instruction}")

        elif key & 0xFF == ord('q'):
            print("Enrollment cancelled.")
            break

    cap.release()
    cv2.destroyAllWindows()

    if len(ref_images) != 5:
        print("Not enough images captured!")
        return None

    return ref_images

# ─────────────────────────────────────────────
#  EMBEDDING EXTRACTION — InsightFace
# ─────────────────────────────────────────────
def extract_save_embeddings(student_folder):
    embeddings = []

    for idx in range(5):
        file_path = os.path.join(student_folder, f"reference_image_{idx+1}.jpg")
        img       = cv2.imread(file_path)
        if img is None:
            print(f"Could not read image {idx+1}")
            return False

        rgb   = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = face_app.get(rgb)

        if len(faces) == 0:
            print(f"No face found in image {idx+1} — please re-enroll!")
            return False

        # Largest face lo
        face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
        embeddings.append(face.normed_embedding)
        print(f"Embedding {idx+1}/5 extracted.")

    save_path = os.path.join(student_folder, "reference_embeddings.npy")
    np.save(save_path, np.array(embeddings))
    print(f"5 embeddings saved!")
    return True


# ─────────────────────────────────────────────
#  VOICE ENROLLMENT — Resemblyzer
# ─────────────────────────────────────────────
def capture_voice(student_folder):
    print("\nVoice Enrollment:")
    print("Please read aloud: 'I am ready to start my exam. My name is [your name].'")
    input("Press ENTER when ready to record (6 seconds)...")

    fs        = 16000
    seconds   = 6
    recording = sd.rec(int(seconds * fs), samplerate=fs, channels=1, dtype='float32')
    sd.wait()

    audio_path = os.path.join(student_folder, "reference_voice.wav")
    wav_write(audio_path, fs, recording)
    print("Voice recorded!")

    wav     = preprocess_wav(audio_path)
    encoder = VoiceEncoder()
    embed   = encoder.embed_utterance(wav)
    print("Voice embedding extracted!")
    return audio_path, embed

# ─────────────────────────────────────────────
#  SAVE TO DATABASE
# ─────────────────────────────────────────────
def save_to_db(student_id, student_name, student_folder, voice_path, voice_embed):
    try:
        db           = get_db()
        students_col = db["students"]
        student_doc  = {
            "id":              student_id,
            "name":            student_name,
            "enrolled_on":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "image_folder":    student_folder,
            "embeddings_path": os.path.join(student_folder, "reference_embeddings.npy"),
            "embedding_model": "insightface_buffalo_sc",
            "voice_embed":     voice_embed.tolist(),
            "voice_model":     "resemblyzer",
            "voice_path":      voice_path,
            "status":          "enrolled"
        }
        students_col.update_one({"id": student_id}, {"$set": student_doc}, upsert=True)
        print("Student info saved in MongoDB!")
    except Exception as e:
        print(f"MongoDB error: {e}")

# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    student_id, student_name = capture_student_info()
    if not student_id or not student_name:
        return

    student_folder = os.path.join("data", student_id)
    os.makedirs(student_folder, exist_ok=True)

    # Face enrollment
    images = capture_images(student_folder)
    if not images:
        return

    if not extract_save_embeddings(student_folder):
        print("Embedding extraction failed! Please re-enroll.")
        return

    # Voice enrollment
    voice_path, voice_embed = capture_voice(student_folder)

    # Save to DB
    save_to_db(student_id, student_name, student_folder, voice_path, voice_embed)

    print(f"\nEnrollment complete for {student_name} ({student_id})!")
    print(f"5 face angles + voice saved successfully.")

if __name__ == "__main__":
    main()