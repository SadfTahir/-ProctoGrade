// src/components/InstructorComponents/TeacherExamResults.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './TeacherExamResults.css';

const BACKEND_URL = "http://localhost:5000";

export default function TeacherExamResults() {
  const { examId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [examData, setExamData] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailedResults, setDetailedResults] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const token = localStorage.getItem('token');

  // Fetch all results for this exam
  useEffect(() => {
    if (!examId || !token) return;

    const fetchResults = async () => {
      try {
        setLoading(true);
        setError('');
        
        const res = await fetch(`${BACKEND_URL}/api/exams/${examId}/results/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.msg || 'Failed to load results');
        }

        const data = await res.json();
        setExamData(data);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError(err.message || 'Error loading results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [examId, token]);

  // Fetch detailed results for selected student
  const handleViewDetails = async (attemptId, studentName) => {
    try {
      setLoadingDetails(true);
      setSelectedStudent(studentName);
      
      const res = await fetch(`${BACKEND_URL}/api/exams/attempt/${attemptId}/detailed`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.msg || 'Failed to load details');
      }

      const data = await res.json();
      setDetailedResults(data);
    } catch (err) {
      console.error('Error fetching details:', err);
      alert(err.message || 'Error loading details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleBack = () => {
    if (detailedResults) {
      setDetailedResults(null);
      setSelectedStudent(null);
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="teacher-results-container">
        <p className="loading-text">Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="teacher-results-container">
        <p className="error-message">{error}</p>
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    );
  }

  if (!examData) {
    return (
      <div className="teacher-results-container">
        <p className="error-message">No results found</p>
      </div>
    );
  }

  // Detailed view for one student
  if (detailedResults) {
    return (
      <div className="teacher-results-container">
        <button className="back-button" onClick={handleBack}>
          ← Back to All Results
        </button>

        <div className="results-header">
          <h2 className="results-title">Detailed Results: {selectedStudent}</h2>
          <p className="results-subtitle">{examData.examTitle}</p>
        </div>

        <div className="summary-card">
          <div className="score-display">
            <div className="score-big">{detailedResults.summary.percentage}%</div>
            <div className="score-breakdown">
              <span>{detailedResults.summary.totalScore} / {detailedResults.summary.maxScore} points</span>
              <span>{detailedResults.summary.correctAnswers} / {detailedResults.summary.totalQuestions} correct</span>
            </div>
          </div>
          <div className="meta-info">
            <p><strong>Submitted:</strong> {new Date(detailedResults.submittedAt).toLocaleString()}</p>
            <p><strong>Graded:</strong> {new Date(detailedResults.gradedAt).toLocaleString()}</p>
          </div>
        </div>

        <h3 className="section-title">Question-by-Question Breakdown</h3>

        <div className="questions-list">
          {detailedResults.breakdown.map((item) => (
            <div key={item.questionNumber} className="question-card">
              <div className="question-header">
                <span className="question-number">Q{item.questionNumber}</span>
                <span className={`badge ${item.isCorrect ? 'badge-correct' : 'badge-incorrect'}`}>
                  {item.pointsAwarded}/{item.maxPoints} pts
                </span>
              </div>

              <p className="question-text">{item.questionText}</p>

              {item.questionType === 'mcq' && item.options && (
                <div className="options-section">
                  <p className="label">Options:</p>
                  <ul className="options-list">
                    {item.options.map((opt, idx) => {
                      const isSelected = idx === item.selectedOptionIndex;
                      const isCorrectAnswer = opt === item.correctAnswer;
                      
                      return (
                        <li
                          key={idx}
                          className={`option ${isSelected ? 'option-selected' : ''} ${isCorrectAnswer ? 'option-correct' : ''}`}
                        >
                          <span className="option-letter">{String.fromCharCode(65 + idx)}.</span>
                          {opt}
                          {isSelected && <span className="badge-small">Student's Answer</span>}
                          {isCorrectAnswer && <span className="badge-small badge-correct-small">Correct Answer</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {item.questionType !== 'mcq' && (
                <div className="answers-section">
                  <div className="answer-box">
                    <p className="label">Student's Answer:</p>
                    <p className="answer-text">{item.studentAnswer}</p>
                  </div>
                  <div className="answer-box">
                    <p className="label">Correct Answer:</p>
                    <p className="answer-text">{item.correctAnswer}</p>
                  </div>
                </div>
              )}

              <div className="justification">
                <p className="label">
                  {item.isCorrect ? '✓' : '✗'} Grading Justification:
                </p>
                <p className="justification-text">{item.justification}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Overview: All students list
  return (
    <div className="teacher-results-container">
      <button className="back-button" onClick={handleBack}>
        ← Back
      </button>

      <div className="results-header">
        <h2 className="results-title">Exam Results</h2>
        <p className="results-subtitle">{examData.examTitle}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{examData.totalAttempts}</div>
          <div className="stat-label">Students Submitted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{examData.stats.averageScore}%</div>
          <div className="stat-label">Class Average</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{examData.stats.highestScore}%</div>
          <div className="stat-label">Highest Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{examData.totalQuestions}</div>
          <div className="stat-label">Total Questions</div>
        </div>
      </div>

      {examData.students.length === 0 ? (
        <p className="empty-text">No student submissions yet.</p>
      ) : (
        <div className="table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Email</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {examData.students.map((student) => {
                const percentageClass = 
                  student.percentage >= 80 ? 'percentage-high' :
                  student.percentage >= 60 ? 'percentage-medium' : 'percentage-low';
                
                return (
                  <tr key={student.attemptId}>
                    <td>{student.studentName}</td>
                    <td>{student.studentEmail}</td>
                    <td>{student.totalScore}/{student.maxScore}</td>
                    <td>
                      <span className={`percentage-badge ${percentageClass}`}>
                        {student.percentage}%
                      </span>
                    </td>
                    <td>{new Date(student.submittedAt).toLocaleString()}</td>
                    <td>
                      <button
                        className="view-button"
                        onClick={() => handleViewDetails(student.attemptId, student.studentName)}
                        disabled={loadingDetails}
                      >
                        {loadingDetails ? 'Loading...' : 'View Details'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}