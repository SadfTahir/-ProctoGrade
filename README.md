# ProctoGrade — Automated AI-Based Exam Proctoring & Grading System

ProctoGrade is an advanced, end-to-end AI-powered solution designed to ensure academic integrity in online examinations and streamline the evaluation process. The system combines real-time automated proctoring (cheating detection) with an intelligent grading mechanism to provide a seamless experience for both educators and students.

---

## 🚀 Key Features

### 🛡️ Intelligent AI Proctoring
* **Face Verification & Detection:** Multi-face detection and unauthorized person alerts.
* **Object Detection:** Real-time identification of electronic gadgets (mobile phones, smartwatches).
* **Tab Switching Control:** Automated logging and warnings if a student switches browser tabs.
* **Audio Analysis:** Background noise and speech detection during active exam sessions.

### 📊 Automated Grading System
* **Descriptive Answer Evaluation:** NLP-based evaluation for conceptual correctness.
* **Instant Dashboard Analytics:** Detailed performance reports for both instructors and administration.

---

## 🛠️ Tech Stack

| Component | Technology / Framework |
| :--- | :--- |
| **Frontend** | Vite.js, React.js, Tailwind CSS |
| **Backend** | Node.js, Express.js |
| **AI / ML Core** | Python, OpenCV, MediaPipe, NetworkX |
| **Database** | MongoDB / PostgreSQL |

---

## 📂 Project Structure

```text
ProctoGrade/
├── exam_proctor/         # Python Core AI & Computer Vision Service
├── proctograde-backend/  # Node.js REST API
└── proctorgrade-frontend/ # React (Vite) User Interface
