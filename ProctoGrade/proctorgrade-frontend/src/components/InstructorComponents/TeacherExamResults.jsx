// src/components/InstructorComponents/TeacherExamResults.jsx
// v6.0 — Stats row removed from proctoring report, clean UI

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './TeacherExamResults.css';
import RubricModal from './Rubricmodal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const PROCTOR_URL = import.meta.env.VITE_PROCTOR_URL || "http://localhost:8000";

const HIGH_SEVERITY_TYPES = [
  'face_not_found', 'multiple_faces', 'phone_detected',
  'tab_switch', 'unknown_voice', 'no_face', 'face_mismatch',
  'earphone_detected', 'prohibited_device',
];

function classifyEvents(events = []) {
  const countMap = {};
  events.forEach((e) => {
    const t = (e.event_type || 'unknown').toLowerCase();
    countMap[t] = (countMap[t] || 0) + 1;
  });
  const classified = {};
  Object.entries(countMap).forEach(([type, count]) => {
    const isHighType = HIGH_SEVERITY_TYPES.some((h) => type.includes(h));
    if (isHighType || count >= 5)   classified[type] = { count, level: 'high' };
    else if (count >= 3)            classified[type] = { count, level: 'medium' };
    else                            classified[type] = { count, level: 'low' };
  });
  return classified;
}

function filterSignificantEvents(events = [], classified = {}) {
  return events.filter((e) => {
    const t     = (e.event_type || 'unknown').toLowerCase();
    const level = classified[t]?.level;
    return level === 'high' || level === 'medium';
  });
}

// ─────────────────────────────────────────────
//  AUDIO PLAYER
// ─────────────────────────────────────────────
function AudioPlayer({ clip, proctoringUrl, token }) {
  const [blobUrl, setBlobUrl]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [attempted, setAttempted] = useState(false);

  const loadAudio = async () => {
    if (blobUrl || loading) return;
    setLoading(true);
    setError('');
    setAttempted(true);
    try {
      const endpoints = [
        `${proctoringUrl}/evidence/audio/stream/${clip.id}`,
        `${proctoringUrl}/evidence/audio/${clip.id}`,
        `${proctoringUrl}/audio/stream/${clip.id}`,
        `${proctoringUrl}/audio/${clip.id}`,
      ];
      let fetched = false;
      for (const url of endpoints) {
        try {
          const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (res.ok) {
            const blob   = await res.blob();
            setBlobUrl(URL.createObjectURL(blob));
            fetched = true;
            break;
          }
        } catch { /* try next */ }
      }
      if (!fetched && clip.file_path) {
        const res = await fetch(`${proctoringUrl}/evidence/audio/file?path=${encodeURIComponent(clip.file_path)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const blob = await res.blob();
          setBlobUrl(URL.createObjectURL(blob));
          fetched = true;
        }
      }
      if (!fetched) setError('Audio file not found on server.');
    } catch {
      setError('Could not load audio. Check Python service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  return (
    <div style={ap.card}>
      <div style={ap.header}>
        <div style={ap.left}>
          <div style={ap.iconWrap}>🔊</div>
          <div>
            <div style={ap.eventLabel}>{clip.event_type?.replace('Suspicious: ', '') || 'Voice Anomaly'}</div>
            <div style={ap.timeLabel}>{new Date(clip.timestamp).toLocaleString()}</div>
          </div>
        </div>
        <span style={ap.badge}>🔴 SUSPICIOUS</span>
      </div>
      {!attempted && !blobUrl && (
        <button style={ap.loadBtn} onClick={loadAudio}>▶ Load & Play Audio</button>
      )}
      {loading && <div style={ap.loadingRow}><div style={ap.spinner} /> Loading audio...</div>}
      {error && (
        <div style={ap.errorMsg}>
          ⚠️ {error}
          <button style={ap.retryBtn} onClick={() => { setAttempted(false); setError(''); }}>Retry</button>
        </div>
      )}
      {blobUrl && <audio controls style={ap.player} src={blobUrl}>Your browser does not support audio playback.</audio>}
    </div>
  );
}

const ap = {
  card:       { background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1.5px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 10 },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  left:       { display: 'flex', alignItems: 'center', gap: 12 },
  iconWrap:   { fontSize: 22, background: '#fee2e2', padding: '7px 9px', borderRadius: 10 },
  eventLabel: { color: '#1e293b', fontSize: 13, fontWeight: 700 },
  timeLabel:  { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  badge:      { padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, color: '#fff', background: '#ef4444' },
  loadBtn:    { padding: '8px 16px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  loadingRow: { display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 },
  spinner:    { width: 16, height: 16, border: '2px solid #e2e8f0', borderTop: '2px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  errorMsg:   { background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 },
  retryBtn:   { background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  player:     { width: '100%', height: 38, borderRadius: 8, outline: 'none', accentColor: '#6366f1' },
};

// ─────────────────────────────────────────────
//  PROCTORING REPORT
// ─────────────────────────────────────────────
function ProctoringReport({ studentId, examId }) {
  const [report, setReport]               = useState(null);
  const [images, setImages]               = useState([]);
  const [audioClips, setAudioClips]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [activeTab, setActiveTab]         = useState('summary');
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAll, setShowAll]             = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!studentId) return;
    fetchProctoringData();
  }, [studentId]);

  const fetchProctoringData = async () => {
    try {
      setLoading(true);
      setError('');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [reportRes, imagesRes, audioRes] = await Promise.all([
        fetch(`${PROCTOR_URL}/report/${studentId}?exam_id=${examId}`, { headers }),
        fetch(`${PROCTOR_URL}/evidence/${studentId}/images?exam_id=${examId}`, { headers }),
        fetch(`${PROCTOR_URL}/evidence/${studentId}/audio?exam_id=${examId}`, { headers }),
      ]);
      const reportData = await reportRes.json().catch(() => ({}));
      const imagesData = await imagesRes.json().catch(() => ({}));
      const audioData  = await audioRes.json().catch(() => ({}));
      if (reportRes.ok) setReport(reportData);
      else setError(reportData?.message || reportData?.detail || 'Failed to load proctoring report');
      if (imagesRes.ok) setImages(imagesData.evidence || imagesData.images || []);
      if (audioRes.ok) {
        const clips = audioData.audio_evidence || audioData.audio_clips || audioData.evidence || audioData.clips || (Array.isArray(audioData) ? audioData : []);
        setAudioClips(clips);
      }
    } catch {
      setError('Proctoring service not reachable. Make sure Python service is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={pr.loadingWrap}>
      <div style={pr.loadSpinner} />
      <span style={{ color: '#64748b', fontSize: 14 }}>Loading proctoring data...</span>
    </div>
  );

  if (error) return (
    <div style={pr.errorBox}>
      <div style={pr.errorIcon}>⚠️</div>
      <div>
        <p style={{ margin: 0, fontWeight: 700, color: '#991b1b' }}>{error}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>
          Make sure Python FastAPI is running: <code>uvicorn api:app --port 8000</code>
        </p>
        <button style={pr.retryBtn} onClick={fetchProctoringData}>↻ Retry</button>
      </div>
    </div>
  );

  if (!report) return <p style={{ color: '#94a3b8', fontSize: 14 }}>No proctoring data found.</p>;

  const classified        = classifyEvents(report.events);
  const significantEvents = filterSignificantEvents(report.events, classified);
  const displayEvents     = showAll ? report.events : significantEvents;
  const hiddenCount       = (report.events?.length || 0) - significantEvents.length;

  const highChips   = Object.entries(classified).filter(([, v]) => v.level === 'high');
  const mediumChips = Object.entries(classified).filter(([, v]) => v.level === 'medium');

  const sigCount  = significantEvents.length;
  const riskLevel = sigCount === 0 ? 'low' : sigCount <= 3 ? 'medium' : 'high';
  const riskConfig = {
    low:    { bg: '#dcfce7', color: '#166534', border: '#86efac', label: '✅ Low Risk' },
    medium: { bg: '#fef9c3', color: '#854d0e', border: '#fde047', label: '⚠️ Medium Risk' },
    high:   { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: '🚨 High Risk' },
  };
  const rc = riskConfig[riskLevel];

  return (
    <div style={pr.wrapper}>

      {/* Risk banner */}
      <div style={{ ...pr.riskBanner, background: rc.bg, color: rc.color, border: `1.5px solid ${rc.border}` }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>{rc.label}</span>
        <span style={{ fontSize: 13 }}>— {sigCount} significant event(s)</span>
        {images.length > 0 && <span style={pr.bannerChip}>📷 {images.length} screenshots</span>}
        {audioClips.length > 0 && <span style={pr.bannerChip}>🔊 {audioClips.length} audio clips</span>}
        {hiddenCount > 0 && <span style={{ fontSize: 11, opacity: 0.75, marginLeft: 4 }}>({hiddenCount} minor filtered)</span>}
      </div>

      {/* Severity chips */}
      {highChips.length > 0 && (
        <div style={pr.chipSection}>
          <p style={{ ...pr.chipTitle, color: '#991b1b' }}>🔴 Critical Violations</p>
          <div style={pr.chipRow}>
            {highChips.map(([type, val]) => (
              <div key={type} style={pr.chipHigh}>
                <span style={pr.chipCount}>{val.count}×</span>
                <span style={pr.chipLabel}>{type.replace('suspicious: ', '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mediumChips.length > 0 && (
        <div style={pr.chipSection}>
          <p style={{ ...pr.chipTitle, color: '#92400e' }}>🟡 Suspicious Activity</p>
          <div style={pr.chipRow}>
            {mediumChips.map(([type, val]) => (
              <div key={type} style={pr.chipMed}>
                <span style={pr.chipCount}>{val.count}×</span>
                <span style={pr.chipLabel}>{type.replace('suspicious: ', '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={pr.tabRow}>
        {[
          { id: 'summary', label: `📋 Event Log (${sigCount})` },
          { id: 'images',  label: `📷 Screenshots (${images.length})` },
          { id: 'audio',   label: `🔊 Audio (${audioClips.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            style={{ ...pr.tabBtn, ...(activeTab === tab.id ? pr.tabActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Event Log */}
      {activeTab === 'summary' && (
        <div style={pr.tabPanel}>
          {displayEvents.length === 0 ? (
            <div style={pr.emptyState}>
              <span style={{ fontSize: 32 }}>✅</span>
              <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>No significant suspicious activity detected</p>
            </div>
          ) : (
            <div style={pr.timeline}>
              {displayEvents.map((ev, i) => {
                const t     = (ev.event_type || '').toLowerCase();
                const level = classified[t]?.level || 'low';
                const cfg   = {
                  high:   { dot: '#ef4444', bg: '#fee2e2', border: '#fca5a5', badge: '#ef4444', txt: '🔴 HIGH' },
                  medium: { dot: '#f59e0b', bg: '#fef9c3', border: '#fde047', badge: '#f59e0b', txt: '🟡 MED' },
                  low:    { dot: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', badge: '#94a3b8', txt: 'LOW' },
                }[level];
                return (
                  <div key={i} style={{ ...pr.tlItem, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <div style={{ ...pr.tlDot, background: cfg.dot }} />
                    <div style={pr.tlBody}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...pr.tlBadge, background: cfg.badge }}>{cfg.txt}</span>
                        <span style={pr.tlEvent}>{ev.event_type}</span>
                      </div>
                      <span style={pr.tlTime}>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {hiddenCount > 0 && (
            <button style={pr.toggleBtn} onClick={() => setShowAll(s => !s)}>
              {showAll ? `▲ Hide ${hiddenCount} minor events` : `▼ Show all ${report.events?.length} events`}
            </button>
          )}
        </div>
      )}

      {/* Tab: Screenshots */}
      {activeTab === 'images' && (
        <div style={pr.tabPanel}>
          {images.length === 0 ? (
            <div style={pr.emptyState}>
              <span style={{ fontSize: 32 }}>📷</span>
              <p style={{ margin: 0, color: '#64748b' }}>No screenshot evidence found.</p>
            </div>
          ) : (
            <div style={pr.imgGrid}>
              {images.map((img, i) => {
                const t         = (img.event_type || '').toLowerCase();
                const level     = classified[t]?.level || 'low';
                const borderClr = level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#e2e8f0';
                return (
                  <div key={i} style={{ ...pr.imgCard, border: `2px solid ${borderClr}` }} onClick={() => setSelectedImage(img)}>
                    {level === 'high'   && <div style={pr.imgCorner}>🔴</div>}
                    {level === 'medium' && <div style={{ ...pr.imgCorner, background: '#f59e0b' }}>🟡</div>}
                    <img src={`data:image/jpeg;base64,${img.image_base64}`} alt={img.event_type} style={pr.thumbnail} />
                    <div style={pr.imgLabel}>
                      <span style={{ ...pr.imgLabelTxt, color: borderClr === '#e2e8f0' ? '#64748b' : borderClr }}>
                        {img.event_type?.replace('Suspicious: ', '')}
                      </span>
                      <span style={pr.imgTime}>{new Date(img.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Audio */}
      {activeTab === 'audio' && (
        <div style={pr.tabPanel}>
          {audioClips.length === 0 ? (
            <div style={pr.emptyState}>
              <span style={{ fontSize: 32 }}>🔊</span>
              <p style={{ margin: 0, color: '#64748b' }}>No suspicious audio clips recorded.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {audioClips.map((clip, i) => (
                <AudioPlayer key={clip.id || clip._id || i} clip={clip} proctoringUrl={PROCTOR_URL} token={token} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div style={pr.lightboxBg} onClick={() => setSelectedImage(null)}>
          <div style={pr.lightboxBox} onClick={e => e.stopPropagation()}>
            <button style={pr.lightboxClose} onClick={() => setSelectedImage(null)}>✕</button>
            <img
              src={`data:image/jpeg;base64,${selectedImage.image_base64}`}
              alt={selectedImage.event_type}
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 10 }}
            />
            <p style={{ color: '#374151', marginTop: 10, fontSize: 13, textAlign: 'center' }}>
              <strong>{selectedImage.event_type}</strong> — {new Date(selectedImage.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function TeacherExamResults() {
  const { examId } = useParams();
  const navigate   = useNavigate();

  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState('');
  const [examData, setExamData]                   = useState(null);
  const [selectedStudent, setSelectedStudent]     = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [detailedResults, setDetailedResults]     = useState(null);
  const [loadingDetails, setLoadingDetails]       = useState(false);
  const [activeDetailTab, setActiveDetailTab]     = useState('results');
  const [showRubricModal, setShowRubricModal]     = useState(false);
  const [rubricSaved, setRubricSaved]             = useState(false);
  const [searchQuery, setSearchQuery]             = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!examId || !token) return;
    fetchResults();
  }, [examId, token]);

  const fetchResults = async () => {
    try {
      setLoading(true); setError('');
      const res = await fetch(`${BACKEND_URL}/api/exams/${examId}/results/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.msg || 'Failed to load results');
      }
      setExamData(await res.json());
    } catch (err) {
      setError(err.message || 'Error loading results');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (attemptId, studentName, studentId) => {
    try {
      setLoadingDetails(true);
      setSelectedStudent(studentName);
      setSelectedStudentId(studentId);
      setActiveDetailTab('results');
      const res = await fetch(`${BACKEND_URL}/api/exams/attempt/${attemptId}/detailed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.msg || 'Failed to load details');
      }
      setDetailedResults(await res.json());
    } catch (err) {
      alert(err.message || 'Error loading details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleBack = () => {
    if (detailedResults) {
      setDetailedResults(null);
      setSelectedStudent(null);
      setSelectedStudentId(null);
    } else {
      navigate(-1);
    }
  };

  const filteredStudents = examData?.students?.filter(s =>
    s.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.studentEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (loading) return (
    <div style={main.pageWrap}>
      <div style={main.loadingCard}>
        <div style={main.pageSpinner} />
        <p style={{ color: '#64748b', margin: 0 }}>Loading exam results...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={main.pageWrap}>
      <div style={main.errorCard}>
        <span style={{ fontSize: 32 }}>⚠️</span>
        <p style={{ color: '#991b1b', fontWeight: 700, margin: 0 }}>{error}</p>
        <button style={main.backBtn} onClick={() => navigate(-1)}>← Go Back</button>
      </div>
    </div>
  );

  if (!examData) return <div style={main.pageWrap}><p style={{ color: '#64748b' }}>No results found.</p></div>;

  // Detailed View
  if (detailedResults) {
    return (
      <div style={main.pageWrap}>
        <div style={main.topBar}>
          <button style={main.backBtn} onClick={handleBack}>← Back to All Results</button>
        </div>
        <div style={main.detailHeader}>
          <div>
            <h2 style={main.detailTitle}>{selectedStudent}</h2>
            <p style={main.detailSubtitle}>{examData.examTitle}</p>
          </div>
          <div style={main.scorePill}>{detailedResults.summary.percentage}%</div>
        </div>

        <div style={main.tabRow}>
          {[
            { id: 'results',    label: '📝 Exam Results' },
            { id: 'proctoring', label: '🎥 Proctoring Report' },
          ].map(tab => (
            <button
              key={tab.id}
              style={{ ...main.tab, ...(activeDetailTab === tab.id ? main.tabActive : {}) }}
              onClick={() => setActiveDetailTab(tab.id)}
            >{tab.label}</button>
          ))}
        </div>

        {activeDetailTab === 'results' && (
          <>
            <div style={main.summaryCard}>
              <div style={main.summaryLeft}>
                <div style={main.bigScore}>{detailedResults.summary.percentage}%</div>
                <div style={main.scoreBreak}>
                  <span>{detailedResults.summary.totalScore} / {detailedResults.summary.maxScore} pts</span>
                  <span>{detailedResults.summary.correctAnswers} / {detailedResults.summary.totalQuestions} correct</span>
                </div>
              </div>
              <div style={main.summaryRight}>
                <div style={main.metaRow}><span style={main.metaLabel}>Submitted</span><span style={main.metaVal}>{new Date(detailedResults.submittedAt).toLocaleString()}</span></div>
                <div style={main.metaRow}><span style={main.metaLabel}>Graded</span><span style={main.metaVal}>{new Date(detailedResults.gradedAt).toLocaleString()}</span></div>
              </div>
            </div>

            <h3 style={main.sectionTitle}>Question-by-Question Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {detailedResults.breakdown.map((item) => (
                <div key={item.questionNumber} style={{ ...main.qCard, borderLeft: `4px solid ${item.isCorrect ? '#22c55e' : '#ef4444'}` }}>
                  <div style={main.qCardHead}>
                    <span style={main.qNum}>Q{item.questionNumber}</span>
                    <span style={{ ...main.ptsBadge, background: item.isCorrect ? '#dcfce7' : '#fee2e2', color: item.isCorrect ? '#166534' : '#991b1b' }}>
                      {item.pointsAwarded}/{item.maxPoints} pts
                    </span>
                    <span style={{ ...main.ptsBadge, background: item.isCorrect ? '#dcfce7' : '#fee2e2', color: item.isCorrect ? '#166534' : '#991b1b', marginLeft: 'auto' }}>
                      {item.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </div>
                  <p style={main.qText}>{item.questionText}</p>

                  {item.questionType === 'mcq' && item.options && (
                    <div style={main.optionsWrap}>
                      {item.options.map((opt, idx) => {
                        const isSelected = idx === item.selectedOptionIndex;
                        const isCorrect  = opt === item.correctAnswer;
                        return (
                          <div key={idx} style={{ ...main.optItem, background: isCorrect ? '#dcfce7' : isSelected ? '#fee2e2' : '#f8fafc', border: `1.5px solid ${isCorrect ? '#86efac' : isSelected ? '#fca5a5' : '#e2e8f0'}` }}>
                            <span style={main.optLetter}>{String.fromCharCode(65 + idx)}.</span>
                            <span style={{ flex: 1 }}>{opt}</span>
                            {isSelected && !isCorrect && <span style={main.optBadgeRed}>Student's Answer</span>}
                            {isCorrect  && <span style={main.optBadgeGrn}>✓ Correct</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {item.questionType !== 'mcq' && (
                    <div style={main.answerGrid}>
                      <div style={main.answerBox}>
                        <p style={main.answerLabel}>Student's Answer:</p>
                        <p style={main.answerText}>{item.studentAnswer}</p>
                      </div>
                      <div style={{ ...main.answerBox, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                        <p style={main.answerLabel}>Correct Answer:</p>
                        <p style={main.answerText}>{item.correctAnswer}</p>
                      </div>
                    </div>
                  )}

                  <div style={main.justification}>
                    <span style={main.justLabel}>{item.isCorrect ? '✓' : '✗'} Grading Justification:</span>
                    <p style={main.justText}>{item.justification}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeDetailTab === 'proctoring' && (
          <ProctoringReport studentId={selectedStudentId} examId={examId} />
        )}
      </div>
    );
  }

  // Overview
  return (
    <div style={main.pageWrap}>
      {rubricSaved && (
        <div style={main.toast}>✅ Rubric saved! Future gradings will use your criteria.</div>
      )}
      <div style={main.topBar}>
        <button style={main.backBtn} onClick={handleBack}>← Back</button>
        <button style={main.rubricBtn} onClick={() => setShowRubricModal(true)}>
          📋 Define Rubric <span style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 400 }}>(optional)</span>
        </button>
      </div>

      <div style={main.pageHeader}>
        <div>
          <h2 style={main.pageTitle}>Exam Results</h2>
          <p style={main.pageSubtitle}>{examData.examTitle}</p>
        </div>
      </div>

      <div style={main.statsGrid}>
        {[
          { val: examData.totalAttempts,            lbl: 'Students Submitted', icon: '👥', color: '#6366f1', bg: '#eef2ff' },
          { val: `${examData.stats.averageScore}%`, lbl: 'Class Average',      icon: '📊', color: '#0891b2', bg: '#e0f2fe' },
          { val: `${examData.stats.highestScore}%`, lbl: 'Highest Score',      icon: '🏆', color: '#059669', bg: '#dcfce7' },
          { val: examData.totalQuestions,           lbl: 'Total Questions',    icon: '❓', color: '#d97706', bg: '#fef9c3' },
        ].map((s, i) => (
          <div key={i} style={{ ...main.statCard, background: s.bg, border: `1.5px solid ${s.color}25` }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div style={{ ...main.statVal, color: s.color }}>{s.val}</div>
            <div style={main.statLbl}>{s.lbl}</div>
          </div>
        ))}
      </div>

      <div style={main.searchWrap}>
        <span style={main.searchIcon}>🔍</span>
        <input style={main.searchInput} type="text" placeholder="Search student by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      {filteredStudents.length === 0 ? (
        <div style={main.emptyState}>
          <span style={{ fontSize: 36 }}>📭</span>
          <p style={{ color: '#64748b', margin: 0 }}>{searchQuery ? 'No students match your search.' : 'No student submissions yet.'}</p>
        </div>
      ) : (
        <div style={main.tableWrap}>
          <table style={main.table}>
            <thead>
              <tr>{['Student Name', 'Email', 'Score', 'Percentage', 'Submitted', 'Action'].map(h => <th key={h} style={main.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, i) => {
                const pctColor = student.percentage >= 80 ? '#166534' : student.percentage >= 60 ? '#854d0e' : '#991b1b';
                const pctBg    = student.percentage >= 80 ? '#dcfce7' : student.percentage >= 60 ? '#fef9c3' : '#fee2e2';
                return (
                  <tr key={student.attemptId} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={main.td}><div style={main.studentName}>{student.studentName}</div></td>
                    <td style={{ ...main.td, color: '#64748b', fontSize: 13 }}>{student.studentEmail}</td>
                    <td style={{ ...main.td, fontWeight: 700 }}>{student.totalScore}/{student.maxScore}</td>
                    <td style={main.td}><span style={{ ...main.pctBadge, background: pctBg, color: pctColor }}>{student.percentage}%</span></td>
                    <td style={{ ...main.td, color: '#64748b', fontSize: 12 }}>{new Date(student.submittedAt).toLocaleString()}</td>
                    <td style={main.td}>
                      <button style={main.viewBtn} onClick={() => handleViewDetails(student.attemptId, student.studentName, student.studentId)} disabled={loadingDetails}>
                        {loadingDetails ? '⏳' : 'View Details →'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showRubricModal && examData?.questions && (
        <RubricModal examId={examId} questions={examData.questions} onClose={() => setShowRubricModal(false)} onSaved={() => { setShowRubricModal(false); setRubricSaved(true); setTimeout(() => setRubricSaved(false), 3000); }} />
      )}
    </div>
  );
}

const main = {
  pageWrap:      { fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif", padding: '1.5rem', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  loadingCard:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '3rem', background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0' },
  pageSpinner:   { width: 36, height: 36, border: '3px solid #e2e8f0', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.9s linear infinite' },
  errorCard:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '3rem', background: '#fff', borderRadius: 16, border: '1.5px solid #fca5a5', textAlign: 'center' },
  topBar:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn:       { padding: '8px 18px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 10, fontWeight: 700, fontSize: 13, color: '#374151', cursor: 'pointer' },
  rubricBtn:     { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  toast:         { position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 9999, background: '#059669', color: 'white', padding: '10px 18px', borderRadius: 12, fontWeight: 700, fontSize: 14 },
  pageHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle:     { margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#111827' },
  pageSubtitle:  { margin: '4px 0 0', color: '#64748b', fontSize: 14 },
  statsGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 },
  statCard:      { borderRadius: 14, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 },
  statVal:       { fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 },
  statLbl:       { fontSize: 12, color: '#64748b', fontWeight: 600 },
  searchWrap:    { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '0 14px' },
  searchIcon:    { fontSize: 16, color: '#94a3b8' },
  searchInput:   { flex: 1, border: 'none', outline: 'none', padding: '12px 0', fontSize: 14, background: 'transparent', color: '#374151' },
  emptyState:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '3rem', background: '#f8fafc', borderRadius: 14, border: '1.5px dashed #e2e8f0' },
  tableWrap:     { background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden' },
  table:         { width: '100%', borderCollapse: 'collapse' },
  th:            { padding: '13px 16px', background: '#f8fafc', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1.5px solid #e2e8f0' },
  td:            { padding: '13px 16px', fontSize: 14, color: '#374151', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  studentName:   { fontWeight: 700, color: '#1e293b' },
  pctBadge:      { display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 },
  viewBtn:       { padding: '7px 16px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  detailHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1.5px solid #e2e8f0' },
  detailTitle:   { margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#111827' },
  detailSubtitle:{ margin: '4px 0 0', color: '#64748b', fontSize: 13 },
  scorePill:     { fontSize: '2rem', fontWeight: 900, color: '#4f46e5', background: '#eef2ff', padding: '8px 24px', borderRadius: 50, border: '2px solid #c7d2fe' },
  tabRow:        { display: 'flex', gap: 8 },
  tab:           { padding: '9px 22px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  tabActive:     { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: '1.5px solid transparent' },
  summaryCard:   { background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  summaryLeft:   { display: 'flex', alignItems: 'center', gap: 20 },
  bigScore:      { fontSize: '3rem', fontWeight: 900, color: '#4f46e5', lineHeight: 1 },
  scoreBreak:    { display: 'flex', flexDirection: 'column', gap: 4, color: '#64748b', fontSize: 13, fontWeight: 600 },
  summaryRight:  { display: 'flex', flexDirection: 'column', gap: 8 },
  metaRow:       { display: 'flex', gap: 10, alignItems: 'center' },
  metaLabel:     { fontSize: 12, color: '#94a3b8', fontWeight: 600, width: 70 },
  metaVal:       { fontSize: 13, color: '#374151', fontWeight: 600 },
  sectionTitle:  { margin: 0, fontSize: '1rem', fontWeight: 800, color: '#374151' },
  qCard:         { background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 },
  qCardHead:     { display: 'flex', alignItems: 'center', gap: 10 },
  qNum:          { background: '#eef2ff', color: '#4f46e5', borderRadius: 8, padding: '3px 10px', fontWeight: 800, fontSize: 13 },
  ptsBadge:      { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  qText:         { margin: 0, color: '#1e293b', fontSize: 14, fontWeight: 500, lineHeight: 1.6 },
  optionsWrap:   { display: 'flex', flexDirection: 'column', gap: 8 },
  optItem:       { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, fontSize: 13 },
  optLetter:     { fontWeight: 800, color: '#4f46e5', width: 20 },
  optBadgeRed:   { marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 10 },
  optBadgeGrn:   { marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: 10 },
  answerGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  answerBox:     { background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' },
  answerLabel:   { margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' },
  answerText:    { margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 },
  justification: { background: '#f8fafc', borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0' },
  justLabel:     { fontSize: 12, fontWeight: 700, color: '#64748b' },
  justText:      { margin: '4px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.6 },
};

const pr = {
  wrapper:      { display: 'flex', flexDirection: 'column', gap: 16 },
  loadingWrap:  { display: 'flex', alignItems: 'center', gap: 12, padding: '2rem', background: '#f8fafc', borderRadius: 12 },
  loadSpinner:  { width: 24, height: 24, border: '2px solid #e2e8f0', borderTop: '2px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  errorBox:     { display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fee2e2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '14px 16px' },
  errorIcon:    { fontSize: 20 },
  retryBtn:     { marginTop: 8, padding: '5px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' },
  riskBanner:   { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 12, flexWrap: 'wrap' },
  bannerChip:   { background: 'rgba(0,0,0,0.08)', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 },
  chipSection:  { display: 'flex', flexDirection: 'column', gap: 8 },
  chipTitle:    { margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' },
  chipRow:      { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chipHigh:     { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 },
  chipMed:      { background: '#fef9c3', border: '1px solid #fde047', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 },
  chipCount:    { fontWeight: 800, fontSize: 13, color: '#1e293b' },
  chipLabel:    { color: '#374151', fontSize: 12 },
  tabRow:       { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tabBtn:       { padding: '7px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabActive:    { background: '#4f46e5', color: '#fff', border: '1.5px solid #4f46e5' },
  tabPanel:     { background: '#f8fafc', borderRadius: 12, padding: 16, border: '1.5px solid #e2e8f0' },
  emptyState:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '2rem' },
  timeline:     { display: 'flex', flexDirection: 'column', gap: 8 },
  tlItem:       { display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8, padding: '8px 12px' },
  tlDot:        { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  tlBody:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  tlEvent:      { color: '#374151', fontSize: 13 },
  tlTime:       { color: '#94a3b8', fontSize: 12, flexShrink: 0, marginLeft: 8 },
  tlBadge:      { padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800, color: '#fff' },
  toggleBtn:    { marginTop: 10, width: '100%', padding: '8px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  imgGrid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  imgCard:      { background: '#fff', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  imgCorner:    { position: 'absolute', top: 6, right: 6, background: '#ef4444', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, zIndex: 1 },
  thumbnail:    { width: '100%', height: 110, objectFit: 'cover', display: 'block' },
  imgLabel:     { padding: '7px 8px' },
  imgLabelTxt:  { display: 'block', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  imgTime:      { display: 'block', fontSize: 10, color: '#94a3b8', marginTop: 2 },
  lightboxBg:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  lightboxBox:  { background: '#fff', borderRadius: 16, padding: 24, maxWidth: '90vw', position: 'relative' },
  lightboxClose:{ position: 'absolute', top: 10, right: 12, background: '#f1f5f9', border: 'none', color: '#374151', fontSize: 18, cursor: 'pointer', borderRadius: 8, width: 32, height: 32 },
};