# ProctoGrade — Automated AI-Based Exam Proctoring & Grading System

ProctoGrade is an advanced, end-to-end AI-powered examination and proctoring platform designed to ensure academic integrity in online testing while automating the test generation and reporting workflow. Developed as a Final Year Project (FYP-II) at **FAST NUCES (Chiniot-Faisalabad Campus)**.

---

## 🎥 Project Demo Video
▶️ **[Watch the Complete ProctoGrade System Demo on Google Drive](https://drive.google.com/file/d/1m1ZJp0oG2j2Q6mbGHFTF4JMSqUZy7E33/view?usp=drive_link)**

---

## 🚀 Core Architecture & Modules

### 🤖 Module 1: AI-Based Test Generation
* **RAG Pipeline:** Utilizes an LLM (Llama 3) combined with a **FAISS** vector database for contextual and accurate question generation from uploaded PDFs/Content.
* **Smart Versioning:** Automatically generates two unique versions of exams based on selected difficulty metrics.
* **Instructor Controls:** Supports dynamic editing, marks adjustment, exam scheduling, and self-learning test modes for student practice.

### 👁️ Module 2: Multi-Model AI Proctoring (Real-Time)
To handle real-time latency at 30 FPS, the system runs 5 heavy models concurrently using optimized frame-skipping and parallel processing:
* **Face Verification:** Powered by **InsightFace** (executes every 15th frame) against a baseline registration snapshot.
* **Gaze & Head Tracking:** Utilizes **MediaPipe** paired with **L2CS-Net** for precise head pose estimation and eye-gaze tracking.
* **Object Detection:** Implements **YOLOv8m** to actively scan for unauthorized electronic gadgets (mobiles, laptops, earbuds) every 3rd frame.
* **Voice Verification:** Integrated with **Resemblyzer** for continuous background audio analysis and speaker verification.
* **OS-Level Control:** Monitored via **pygetwindow** for tab-switch detection (with automated screenshot logging) alongside browser-level clipboard copy-paste blocking.
* *Optimization:* Implemented a 15-second cooldown on screenshot captures to mitigate Database (DB) flooding. A suspicion score > 55% automatically saves the snapshot as binary evidence.

### 📊 Module 3: AI Report Generation & Dashboard
* Comprehensive analytics dashboard for educators displaying individual student summaries.
* Violation reports containing precise timestamps and corresponding snapshot/binary evidence for auditing.

---

## 🛠️ Tech Stack

| Component | Technology / Framework |
| :--- | :--- |
| **Frontend** | React.js, Vite.js, Tailwind CSS |
| **Backend API** | Node.js, Express.js, FastAPI |
| **AI / ML Core** | Python, Llama 3, FAISS, OpenCV, YOLOv8, InsightFace, MediaPipe |
| **Database** | MongoDB / PostgreSQL |

---

## 📂 Project Structure

```text
ProctoGrade/
├── exam_proctor/          # Python Core AI & Computer Vision Services (FastAPI)
├── proctograde-backend/   # Node.js REST API Layer
└── proctorgrade-frontend/  # React.js (Vite) User Interface
