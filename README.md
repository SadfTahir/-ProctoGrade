<div align="center">

# 🎓 ProctoGrade
### Automated AI-Based Exam Proctoring & Grading System

*An end-to-end AI-powered examination and proctoring platform ensuring academic integrity in online testing — while automating test generation and reporting.*

[![Final Year Project](https://img.shields.io/badge/FYP--II-FAST%20NUCES-blue?style=for-the-badge)](https://www.nu.edu.pk/)
[![Campus](https://img.shields.io/badge/Campus-Chiniot--Faisalabad-orange?style=for-the-badge)]()
[![Status](https://img.shields.io/badge/Status-Completed-brightgreen?style=for-the-badge)]()

[![React](https://img.shields.io/badge/React.js-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&color=9333EA&height=4&width=1000" width="100%"/>

## 📽️ Project Demo

▶️ **[Watch the Complete ProctoGrade System Demo](https://drive.google.com/file/d/1m1ZJp0oG2j2Q6mbGHFTF4JMSqUZy7E33/view?usp=drive_link)**

---

## 🖼️ FYP Poster

<div align="center">
  <img src="./Final_Poster_design (22.5 x 34.5 in).png" alt="ProctoGrade FYP Poster" width="700"/>
</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [FYP Poster](#️-fyp-poster)
- [Core Architecture & Modules](#-core-architecture--modules)
  - [Module 1: AI-Based Test Generation](#-module-1-ai-based-test-generation)
  - [Module 2: Multi-Model AI Proctoring](#-module-2-multi-model-ai-proctoring-real-time)
  - [Module 3: AI Report Generation & Dashboard](#-module-3-ai-report-generation--dashboard)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [System Highlights](#-system-highlights)
- [Team & Acknowledgements](#-team--acknowledgements)

---

## 📖 Overview

**ProctoGrade** is a comprehensive AI-driven exam management platform built to solve two major problems in online assessment:

1. **Manual test creation is slow** — instructors spend hours writing and formatting exam questions.
2. **Online exams are easy to cheat on** — traditional platforms lack real-time, multi-signal cheating detection.

ProctoGrade solves both by combining a **Retrieval-Augmented Generation (RAG) pipeline** for intelligent question generation with a **real-time, multi-model proctoring engine** that monitors face identity, gaze, objects, voice, and OS-level activity — all backed by a clean analytics dashboard for instructors.

> Developed as a **Final Year Project (FYP-II)** at **FAST NUCES, Chiniot-Faisalabad Campus**.

---

## 🚀 Core Architecture & Modules

### 🤖 Module 1: AI-Based Test Generation

| Feature | Description |
| :--- | :--- |
| **RAG Pipeline** | Combines **Llama 3** with a **FAISS** vector database to generate contextually accurate questions directly from uploaded PDFs/course content. |
| **Smart Versioning** | Automatically produces **two unique exam versions** based on selected difficulty metrics — reducing collusion risk. |
| **Instructor Controls** | Full control over dynamic question editing, marks adjustment, exam scheduling, and a **self-learning practice mode** for students. |

---

### 👁️ Module 2: Multi-Model AI Proctoring (Real-Time)

To sustain real-time performance at **30 FPS**, ProctoGrade runs **five heavy AI models concurrently**, using optimized frame-skipping and parallel processing to balance accuracy with latency.

| Model | Purpose | Optimization |
| :--- | :--- | :--- |
| **InsightFace** | Face verification against baseline registration snapshot | Runs every **15th frame** |
| **MediaPipe + L2CS-Net** | Gaze tracking & precise head pose estimation | Continuous lightweight tracking |
| **YOLOv8m** | Detects unauthorized electronic gadgets (mobiles, laptops, earbuds) | Runs every **3rd frame** |
| **Resemblyzer** | Continuous background audio analysis & speaker verification | Real-time audio stream |
| **pygetwindow** | OS-level tab-switch detection + clipboard copy-paste blocking | Automated screenshot logging on violation |

**⚡ Smart Evidence Handling:**
- A **15-second cooldown** on screenshot captures prevents database flooding.
- Snapshots are only saved as **binary evidence** when the suspicion score exceeds **55%**, keeping storage efficient and audit trails meaningful.

---

### 📊 Module 3: AI Report Generation & Dashboard

- 📈 Comprehensive **analytics dashboard** for educators with individual student performance summaries.
- 🚨 Detailed **violation reports** with precise timestamps and linked snapshot/binary evidence for auditing and review.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React.js, Vite.js, Tailwind CSS |
| **Backend API** | Node.js, Express.js, FastAPI |
| **AI / ML Core** | Python, Llama 3, FAISS, OpenCV, YOLOv8, InsightFace, MediaPipe, L2CS-Net, Resemblyzer |
| **Database** | MongoDB / PostgreSQL |

---

## 📂 Project Structure

```text
ProctoGrade/
├── exam_proctor/            # Python Core AI & Computer Vision Services (FastAPI)
├── proctograde-backend/     # Node.js REST API Layer
└── proctorgrade-frontend/   # React.js (Vite) User Interface
```

---

## ✨ System Highlights

- ✅ Real-time proctoring at **30 FPS** across 5 concurrent AI models
- ✅ RAG-based question generation ensures contextually grounded, non-generic exams
- ✅ Dual exam versioning to minimize cheating via answer-sharing
- ✅ Evidence-efficient storage with suspicion-score-based snapshot triggers
- ✅ Full-stack architecture separating AI services, backend API, and frontend UI

---

## 👥 Team & Acknowledgements

Developed as a **Final Year Project (FYP-  I & II)** at **FAST NUCES — Chiniot-Faisalabad Campus**.

---

<div align="center">

**⭐ If you find this project interesting, consider giving it a star!**

</div>
