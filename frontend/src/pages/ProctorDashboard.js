import React, { useEffect, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';

export default function ProctorDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [ufmStudents, setUfmStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMarkingUfm, setIsMarkingUfm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showUfmModal, setShowUfmModal] = useState(false);
  const [ufmReason, setUfmReason] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // null for all, or student_id for specific student

  // Fetch alerts and UFM data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch alerts
      const alertsResponse = await fetch('http://localhost:5000/alerts');
      const alertsData = await alertsResponse.json();

      // Fetch UFM students
      const ufmResponse = await fetch('http://localhost:5000/api/ufm/exam_2025_ai');
      const ufmData = await ufmResponse.json();

      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setUfmStudents(ufmData.status === 'success' ? ufmData.ufm_students : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load dashboard data. Please try again.');
      setAlerts([]);
      setUfmStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to mark student for unfair means
  const markForUnfairMeans = async (studentId, reason) => {
    if (isMarkingUfm) return;

    setIsMarkingUfm(true);
    try {
      const response = await fetch('http://localhost:5000/api/ufm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_id: studentId,
          exam_id: 'exam_2025_ai',
          reason: reason || 'High alert frequency - marked by proctor',
          proctor_id: 'proctor_dashboard'
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Refresh data to update the display
        await fetchData();
        setShowUfmModal(false);
        setSelectedStudent(null);
        setUfmReason('');
        alert(`✅ Student ${studentId} has been marked for unfair means`);
      } else {
        alert(`❌ Failed to mark student: ${data.message}`);
      }
    } catch (error) {
      console.error('Error marking for UFM:', error);
      alert('❌ Error marking student for unfair means. Please try again.');
    } finally {
      setIsMarkingUfm(false);
    }
  };

  // Function to reset alerts and UFM data
  const resetExamData = async (studentId = null) => {
    if (isResetting) return;

    setIsResetting(true);
    try {
      const payload = { exam_id: 'exam_2025_ai', include_legacy: true };
      if (studentId) {
        payload.student_id = studentId;
      }

      console.log('Sending reset request:', payload);

      const response = await fetch('http://localhost:5000/api/exam/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('Reset response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Reset failed with status:', response.status, errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Reset response data:', data);

      if (data.status === 'success') {
        // Refresh data immediately to update the display
        await fetchData();
        setShowResetModal(false);
        setResetTarget(null);
        
        const targetDesc = studentId ? `for student ${studentId}` : 'for all students';
        const summary = data.removed || {};
        const total = (summary.ufm_removed || 0) + (summary.alerts_removed || 0) + 
                      (summary.exam_alerts_removed || 0) + (summary.exam_terminations_removed || 0) +
                      (summary.registered_faces_removed || 0);
        
        alert(`✅ Reset successful ${targetDesc}\n\nRemoved:\n- UFM records: ${summary.ufm_removed || 0}\n- Alerts: ${summary.alerts_removed || 0}\n- Exam alerts: ${summary.exam_alerts_removed || 0}\n- Terminations: ${summary.exam_terminations_removed || 0}\n- Registered faces: ${summary.registered_faces_removed || 0}\n\nTotal: ${total} records`);
      } else {
        console.error('Reset failed:', data);
        alert(`❌ Failed to reset data: ${data.message}`);
      }
    } catch (error) {
      console.error('Error resetting exam data:', error);
      alert(`❌ Error resetting exam data: ${error.message}\n\nPlease check:\n1. Backend server is running\n2. Browser console for details`);
    } finally {
      setIsResetting(false);
    }
  };

  // Transform array format to group by student and count different types of alerts
  const alertCounts = [];

  if (Array.isArray(alerts)) {
    // Group alerts by student_id
    const studentAlerts = {};
    alerts.forEach(alert => {
      const studentId = alert.student_id;
      if (!studentAlerts[studentId]) {
        studentAlerts[studentId] = [];
      }
      studentAlerts[studentId].push(alert);
    });

    // Count alerts for each student
    Object.entries(studentAlerts).forEach(([student, logs]) => {
      const alertLogs = logs.filter(a => a.direction.startsWith("ALERT"));
      const counts = {
        left: 0,
        right: 0,
        up: 0,
        down: 0,
        tilt: 0,
        audio: 0,
        total: alertLogs.length
      };

      alertLogs.forEach(alert => {
        if (alert.direction.includes("Audio Anomaly")) counts.audio++;
        else if (alert.direction.includes("Left")) counts.left++;
        else if (alert.direction.includes("Right")) counts.right++;
        else if (alert.direction.includes("Up")) counts.up++;
        else if (alert.direction.includes("Down")) counts.down++;
        else if (alert.direction.includes("Tilting")) counts.tilt++;
      });

      alertCounts.push({ student, counts });
    });
  }

  // Check if student is marked for UFM
  const isStudentMarkedUfm = (studentId) => {
    return ufmStudents.some(ufm => ufm.student_id === studentId);
  };

  const alertBarData = alertCounts.map(({ student, counts }) => ({
    student,
    alerts: counts.total,
    flagged: isStudentMarkedUfm(student) ? 'Yes' : 'No'
  }));

  // Find student with most alerts
  const studentWithMostAlerts = alertCounts.length > 0
    ? alertCounts.reduce((max, current) =>
        current.counts.total > max.counts.total ? current : max
      )
    : null;

  // Calculate summary statistics
  const totalAlerts = alertCounts.reduce((sum, student) => sum + student.counts.total, 0);
  const totalStudents = alertCounts.length;
  const flaggedStudents = ufmStudents.length;
  const avgAlertsPerStudent = totalStudents > 0 ? (totalAlerts / totalStudents).toFixed(1) : 0;

  // Pie chart data for alert types
  const alertTypeData = [
    { name: 'Head Movement', value: alertCounts.reduce((sum, s) => sum + s.counts.left + s.counts.right + s.counts.up + s.counts.down + s.counts.tilt, 0), color: '#FF6B6B' },
    { name: 'Audio Anomalies', value: alertCounts.reduce((sum, s) => sum + s.counts.audio, 0), color: '#4ECDC4' },
  ];

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e9ecef',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <h4 style={{ color: '#6c757d', margin: 0 }}>Loading Dashboard...</h4>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⚠️</div>
          <h4 style={{ color: '#dc3545', marginBottom: '20px' }}>Error Loading Dashboard</h4>
          <p style={{ color: '#6c757d', marginBottom: '30px' }}>{error}</p>
          <button
            onClick={fetchData}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
      fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e9ecef',
        padding: '20px 0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{
                color: '#2c3e50',
                margin: 0,
                fontSize: '2rem',
                fontWeight: '700'
              }}>
                📊 Proctor Dashboard
              </h1>
              <p style={{
                color: '#6c757d',
                margin: '5px 0 0 0',
                fontSize: '0.95rem'
              }}>
                AI-Powered Examination Monitoring System
              </p>
            </div>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{
                backgroundColor: '#e9ecef',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                color: '#495057'
              }}>
                🕒 Live Monitoring Active
              </div>
              <button
                onClick={() => {
                  setResetTarget(null);
                  setShowResetModal(true);
                }}
                style={{
                  backgroundColor: '#ffc107',
                  color: '#000',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: '600'
                }}
              >
                🗑️ Reset All Data
              </button>
              <button
                onClick={fetchData}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '30px' }}>
        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#007bff',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '15px'
              }}>
                👥
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem', fontWeight: '700' }}>
                  {totalStudents}
                </h3>
                <p style={{ margin: '5px 0 0 0', color: '#6c757d', fontSize: '0.9rem' }}>
                  Active Students
                </p>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#dc3545',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '15px'
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem', fontWeight: '700' }}>
                  {totalAlerts}
                </h3>
                <p style={{ margin: '5px 0 0 0', color: '#6c757d', fontSize: '0.9rem' }}>
                  Total Alerts
                </p>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#ff6b6b',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '15px'
              }}>
                🚫
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem', fontWeight: '700' }}>
                  {flaggedStudents}
                </h3>
                <p style={{ margin: '5px 0 0 0', color: '#6c757d', fontSize: '0.9rem' }}>
                  Flagged Students
                </p>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#28a745',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '15px'
              }}>
                📊
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem', fontWeight: '700' }}>
                  {avgAlertsPerStudent}
                </h3>
                <p style={{ margin: '5px 0 0 0', color: '#6c757d', fontSize: '0.9rem' }}>
                  Avg Alerts/Student
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Alerted Student Section */}
        {studentWithMostAlerts && studentWithMostAlerts.counts.total > 0 && (
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            marginBottom: '30px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{
                color: '#2c3e50',
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: '700'
              }}>
                🚨 High Risk Student
              </h2>
              {isStudentMarkedUfm(studentWithMostAlerts.student) && (
                <span style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  FLAGGED FOR UFM
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                backgroundColor: '#007bff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                marginRight: '20px'
              }}>
                👤
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  color: '#2c3e50',
                  margin: '0 0 10px 0',
                  fontSize: '1.8rem',
                  fontWeight: '700'
                }}>
                  {studentWithMostAlerts.student}
                </h3>
                <div style={{
                  backgroundColor: '#fff3cd',
                  color: '#856404',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  display: 'inline-block',
                  fontWeight: '600'
                }}>
                  {studentWithMostAlerts.counts.total} Total Alerts
                </div>
              </div>
              {!isStudentMarkedUfm(studentWithMostAlerts.student) && (
                <button
                  onClick={() => {
                    setSelectedStudent(studentWithMostAlerts.student);
                    setShowUfmModal(true);
                  }}
                  style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  🚫 Flag for UFM
                </button>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '15px'
            }}>
              {[
                { label: 'Left', value: studentWithMostAlerts.counts.left, icon: '⬅️' },
                { label: 'Right', value: studentWithMostAlerts.counts.right, icon: '➡️' },
                { label: 'Up', value: studentWithMostAlerts.counts.up, icon: '⬆️' },
                { label: 'Down', value: studentWithMostAlerts.counts.down, icon: '⬇️' },
                { label: 'Tilt', value: studentWithMostAlerts.counts.tilt, icon: '🔄' },
                { label: 'Audio', value: studentWithMostAlerts.counts.audio, icon: '🔊' }
              ].map((item, index) => (
                <div key={index} style={{
                  backgroundColor: item.value > 0 ? '#f8d7da' : '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: `1px solid ${item.value > 0 ? '#f5c6cb' : '#e9ecef'}`
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>{item.icon}</div>
                  <div style={{
                    fontSize: '1.2rem',
                    fontWeight: '700',
                    color: item.value > 0 ? '#721c24' : '#6c757d'
                  }}>
                    {item.value}
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#6c757d',
                    textTransform: 'uppercase',
                    fontWeight: '600'
                  }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '30px',
          marginBottom: '30px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{
              color: '#2c3e50',
              margin: '0 0 20px 0',
              fontSize: '1.3rem',
              fontWeight: '700'
            }}>
              📈 Alert Distribution by Student
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={alertBarData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
                <XAxis
                  dataKey="student"
                  tick={{ fill: '#6c757d', fontSize: '12px' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: '#6c757d', fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar dataKey="alerts" fill="#007bff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            backgroundColor: 'white',
            padding: '25px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{
              color: '#2c3e50',
              margin: '0 0 20px 0',
              fontSize: '1.3rem',
              fontWeight: '700'
            }}>
              📊 Alert Types
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={alertTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {alertTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Students Overview */}
        <div style={{
          backgroundColor: 'white',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h3 style={{
              color: '#2c3e50',
              margin: 0,
              fontSize: '1.3rem',
              fontWeight: '700'
            }}>
              👥 Student Monitoring Overview
            </h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Search students..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: '1px solid #e9ecef',
                  fontSize: '0.9rem',
                  width: '250px'
                }}
              />
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {alertCounts
              .filter(({ student }) => student.toLowerCase().includes(search.toLowerCase()))
              .map(({ student, counts }) => {
                const isFlagged = isStudentMarkedUfm(student);
                return (
                  <div key={student} style={{
                    backgroundColor: isFlagged ? '#f8d7da' : 'white',
                    border: `2px solid ${isFlagged ? '#dc3545' : '#e9ecef'}`,
                    borderRadius: '12px',
                    padding: '20px',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                  }}
                  >
                    {isFlagged && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        FLAGGED
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: isFlagged ? '#dc3545' : '#007bff',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        marginRight: '15px'
                      }}>
                        👤
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{
                          color: '#2c3e50',
                          margin: '0 0 5px 0',
                          fontSize: '1.1rem',
                          fontWeight: '700'
                        }}>
                          {student}
                        </h4>
                        <div style={{
                          backgroundColor: counts.total > 5 ? '#dc3545' : counts.total > 2 ? '#ffc107' : '#28a745',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '15px',
                          display: 'inline-block',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}>
                          {counts.total} Alert{counts.total !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '10px',
                      marginBottom: '15px'
                    }}>
                      {[
                        { label: 'Left', value: counts.left },
                        { label: 'Right', value: counts.right },
                        { label: 'Up', value: counts.up },
                        { label: 'Down', value: counts.down },
                        { label: 'Tilt', value: counts.tilt },
                        { label: 'Audio', value: counts.audio }
                      ].map((item, index) => (
                        <div key={index} style={{
                          textAlign: 'center',
                          padding: '8px',
                          backgroundColor: item.value > 0 ? '#fff3cd' : '#f8f9fa',
                          borderRadius: '6px',
                          border: `1px solid ${item.value > 0 ? '#ffeaa7' : '#e9ecef'}`
                        }}>
                          <div style={{
                            fontSize: '1rem',
                            fontWeight: '700',
                            color: item.value > 0 ? '#856404' : '#6c757d'
                          }}>
                            {item.value}
                          </div>
                          <div style={{
                            fontSize: '0.7rem',
                            color: '#6c757d',
                            textTransform: 'uppercase',
                            fontWeight: '600'
                          }}>
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {!isFlagged && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudent(student);
                          setShowUfmModal(true);
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: 'transparent',
                          color: '#dc3545',
                          border: '2px solid #dc3545',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          transition: 'all 0.2s ease',
                          marginBottom: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#dc3545';
                          e.target.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                          e.target.style.color = '#dc3545';
                        }}
                      >
                        🚫 Flag for UFM
                      </button>
                    )}
                    
                    {(isFlagged || counts.total > 0) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setResetTarget(student);
                          setShowResetModal(true);
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: 'transparent',
                          color: '#6c757d',
                          border: '2px solid #6c757d',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#6c757d';
                          e.target.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                          e.target.style.color = '#6c757d';
                        }}
                      >
                        🗑️ Reset Data
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* UFM Modal */}
      {showUfmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{
              color: '#2c3e50',
              margin: '0 0 20px 0',
              fontSize: '1.4rem',
              fontWeight: '700'
            }}>
              🚫 Flag Student for Unfair Means
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <p style={{
                color: '#6c757d',
                margin: '0 0 15px 0',
                fontSize: '1rem'
              }}>
                Are you sure you want to flag <strong>{selectedStudent}</strong> for unfair means?
                This action cannot be undone.
              </p>

              <label style={{
                display: 'block',
                color: '#2c3e50',
                fontWeight: '600',
                marginBottom: '8px',
                fontSize: '0.95rem'
              }}>
                Reason for flagging:
              </label>
              <textarea
                value={ufmReason}
                onChange={(e) => setUfmReason(e.target.value)}
                placeholder="Enter reason for flagging this student..."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowUfmModal(false);
                  setSelectedStudent(null);
                  setUfmReason('');
                }}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => markForUnfairMeans(selectedStudent, ufmReason)}
                disabled={isMarkingUfm}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: isMarkingUfm ? 'not-allowed' : 'pointer',
                  opacity: isMarkingUfm ? 0.6 : 1
                }}
              >
                {isMarkingUfm ? 'Flagging...' : '🚫 Flag Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{
              color: '#2c3e50',
              margin: '0 0 20px 0',
              fontSize: '1.4rem',
              fontWeight: '700'
            }}>
              🗑️ Reset Exam Data
            </h3>

            <div style={{ marginBottom: '25px' }}>
              <div style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '15px'
              }}>
                <p style={{
                  color: '#856404',
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}>
                  ⚠️ Warning: This action cannot be undone!
                </p>
              </div>

              <p style={{
                color: '#6c757d',
                margin: '0 0 15px 0',
                fontSize: '1rem'
              }}>
                {resetTarget 
                  ? `This will clear all alerts and UFM flags for student ${resetTarget}.`
                  : 'This will clear ALL alerts and UFM flags for ALL students in this exam.'
                }
              </p>

              <p style={{
                color: '#495057',
                margin: 0,
                fontSize: '0.9rem'
              }}>
                The following data will be deleted:
              </p>
              <ul style={{
                color: '#6c757d',
                fontSize: '0.9rem',
                marginTop: '10px',
                paddingLeft: '25px'
              }}>
                <li>All UFM (Unfair Means) records</li>
                <li>All exam alerts and warnings</li>
                <li>All exam termination records</li>
                <li>All general alerts for this exam</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetTarget(null);
                }}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => resetExamData(resetTarget)}
                disabled={isResetting}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  opacity: isResetting ? 0.6 : 1
                }}
              >
                {isResetting ? 'Resetting...' : '🗑️ Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}