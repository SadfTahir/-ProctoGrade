from db_connect import get_db
import datetime

def save_event(student_id, event_type, exam_id=None, session_id=None):
    db = get_db()
    event = {
        "student_id": student_id,        # ✅ consistent field name
        "exam_id":    exam_id,           # ✅ exam_id add kiya
        "session_id": session_id,        # ✅ session_id add kiya
        "event_type": event_type,
        "timestamp":  datetime.datetime.now()
    }
    db["events"].insert_one(event)
    print(f"🧾 Event saved: {event_type}")