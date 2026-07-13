# ProctoGrade — Automated AI-Based Exam Proctoring & Grading System

An automated, end-to-end AI alternative for online examinations. From intelligent exam creation via RAG to multi-model real-time proctoring and comprehensive analytics dashboards.

---

## 🛠️ System Architecture & Modules

### Module 1 — AI-Based Test Generation & Self-Practice
* **RAG-Driven Synthesis:** Combines Llama 3 with a FAISS Vector Database to automatically generate course-specific exams from raw documents or PDFs provided by instructors.
* **Dynamic Versioning:** Automatically structures and provisions two separate variations of the test pipeline matching target baseline metrics.
* **Self-Learning Track:** Integrated portal enabling students to initiate on-demand practice tests backed by localized performance metrics.

### Module 2 — Multi-Model Real-Time AI Proctoring
To sustain multi-model executions concurrently without running into performance throttling, the background processor applies structural frame-skipping over an active 30 FPS webcam feed:
* **InsightFace:** Executes facial verification routines against standard registration logs precisely every 15th frame.
* **MediaPipe & L2CS-Net:** Synchronizes continuous 3D gaze vector analysis and spatial head-pose deviation auditing.
* **YOLOv8m:** Runs target classification sweeps looking for cellphones, hidden devices, or earbuds every 3rd frame.
* **Resemblyzer:** Live background audio sampling and verification mapping to handle voice presence anomalies.
* **OS Clipboard Control:** Leverages pygetwindow to prevent systemic tab-switches and block unauthorized environment copy-paste routines.

### Module 3 — Automated Grading & Evaluation Pipeline
* **Descriptive Grading:** Evaluates structural, lengthy descriptive open questions relying on conceptual semantic scoring instead of rigid exact match criteria.
* **Auditing Logs:** Populates an analytical interface dashboard with timestamped visual violations logs for internal review boards.

---

## 💻 Tech Stack

* **System Languages & API Services:** Python, FastAPI, React, Node.js, TailwindCSS
* **Deep Learning, Vision & NLP:** Llama 3, FAISS (RAG), YOLOv8m, InsightFace, MediaPipe, L2CS-Net, Resemblyzer, PyTorch, HuggingFace, OpenCV
* **Infrastructure:** MongoDB, Git

---

## 📂 Directory Tree

```text
ProctoGrade/
├── exam_proctor/          # Python Core AI, CV Services & FastAPI Endpoints
├── proctograde-backend/   # Node.js, Express.js Core Backend System
└── proctorgrade-frontend/ # Vite + React.js Client Interface Dashboard
