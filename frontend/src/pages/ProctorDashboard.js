import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function ProctorDashboard() {
  const [alerts, setAlerts] = useState({});
  const [search, setSearch] = useState("");
//'http://localhost:5000/alerts'
  useEffect(() => {
    fetch('http://localhost:5000/alerts')
      .then(res => res.json())
      .then(data => {
        console.log('Alerts data received:', data);
        setAlerts(data);
      })
      .catch(error => {
        console.error('Error fetching alerts:', error);
        setAlerts([]);
      });
  }, []);

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

  const alertBarData = alertCounts.map(({ student, counts }) => ({
    student,
    alerts: counts.total
  }));

  // Find student with most alerts
  const studentWithMostAlerts = alertCounts.length > 0 
    ? alertCounts.reduce((max, current) => 
        current.counts.total > max.counts.total ? current : max
      )
    : null;

  return (
    <div className="container-fluid" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '20px' }}>
      <div className="row">
        <div className="col-12">
          <div style={{ 
            backgroundColor: '#2c3e50', 
            color: 'white', 
            padding: '25px', 
            borderRadius: '15px', 
            marginBottom: '30px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h1 style={{ margin: 0, fontWeight: 'bold', fontSize: '2.5rem' }}>
              📊 AI Proctor Dashboard
            </h1>
            <p style={{ margin: '10px 0 0 0', fontSize: '1.1rem', opacity: 0.9 }}>
              Real-time monitoring and analytics for online examinations
            </p>
          </div>
        </div>
        
        {/* Student with Most Alerts Section */}
        {studentWithMostAlerts && studentWithMostAlerts.counts.total > 0 && (
          <div className="col-12 mb-4">
            <div style={{ 
              backgroundColor: '#1e272e', 
              color: 'white', 
              padding: '25px', 
              borderRadius: '15px',
              boxShadow: '0 8px 16px rgba(30, 39, 46, 0.3)',
              border: '3px solid #1e272e',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                 🚨 Top Alerted Student 🚨
              </div>
              <div style={{ 
                fontSize: '3.5rem', 
                fontWeight: 'bold', 
                marginBottom: '15px',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                color: '#ff4757'
              }}>
                👤 {studentWithMostAlerts.student}
              </div>
              <div style={{ 
                fontSize: '2.5rem', 
                fontWeight: 'bold',
                marginBottom: '20px',
                backgroundColor: 'rgba(255,71,87,0.2)',
                padding: '15px',
                borderRadius: '10px',
                display: 'inline-block',
                color: '#ff6b81'
              }}>
                {studentWithMostAlerts.counts.total} Total Alerts
              </div>
              <div style={{ fontSize: '1.2rem', opacity: 0.9, marginTop: '15px' }}>
                <span style={{ display: 'inline-block', margin: '5px 10px', padding: '10px', backgroundColor: '#ff6b81', borderRadius: '8px', color: 'white' }}>
                  ⬅️ Left: {studentWithMostAlerts.counts.left}
                </span>
                <span style={{ display: 'inline-block', margin: '5px 10px', padding: '10px', backgroundColor: '#ff6b81', borderRadius: '8px', color: 'white' }}>
                  ➡️ Right: {studentWithMostAlerts.counts.right}
                </span>
                <span style={{ display: 'inline-block', margin: '5px 10px', padding: '10px', backgroundColor: '#ff6b81', borderRadius: '8px', color: 'white' }}>
                  ⬆️ Up: {studentWithMostAlerts.counts.up}
                </span>
                <span style={{ display: 'inline-block', margin: '5px 10px', padding: '10px', backgroundColor: '#ff6b81', borderRadius: '8px', color: 'white' }}>
                  ⬇️ Down: {studentWithMostAlerts.counts.down}
                </span>
                <span style={{ display: 'inline-block', margin: '5px 10px', padding: '10px', backgroundColor: '#ff6b81', borderRadius: '8px', color: 'white' }}>
                  🔄 Tilt: {studentWithMostAlerts.counts.tilt}
                </span>
                <span style={{ display: 'inline-block', margin: '5px 10px', padding: '10px', backgroundColor: '#ff6b81', borderRadius: '8px', color: 'white' }}>
                  🔊 Audio: {studentWithMostAlerts.counts.audio}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Chart Section */}
        <div className="col-12 mb-5">
          <div style={{ 
            backgroundColor: 'white', 
            padding: '25px', 
            borderRadius: '15px', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            border: '2px solid #e9ecef'
          }}>
            <h4 style={{ color: '#2c3e50', fontWeight: 'bold', marginBottom: '20px', fontSize: '1.5rem' }}>
              📈 Alerts per Student
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={alertBarData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                <XAxis dataKey="student" tick={{ fill: '#6c757d' }} />
                <YAxis allowDecimals={false} tick={{ fill: '#6c757d' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #dee2e6',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="alerts" fill="#dc3545" name="Alert Count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alert Summary Section */}
        <div className="col-12 mb-4">
          <div style={{ 
            backgroundColor: 'white', 
            padding: '25px', 
            borderRadius: '15px', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            border: '2px solid #e9ecef'
          }}>
            <h4 style={{ color: '#2c3e50', fontWeight: 'bold', marginBottom: '20px', fontSize: '1.5rem' }}>
              📋 Alert Summary
            </h4>
            <div className="mb-4">
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search by student Roll...."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: '2px solid #e9ecef',
                  fontSize: '16px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  maxWidth: '400px'
                }}
              />
            </div>
            <div className="row">
              {alertCounts
                .filter(({ student }) => student.toLowerCase().includes(search.toLowerCase()))
                .map(({ student, counts }) => {
                const hasAlerts = counts.total > 0;
                return (
                  <div key={student} className="col-md-6 col-lg-4 mb-4">
                    <div style={{ 
                      backgroundColor: hasAlerts ? '#f8d7da' : '#d4edda', 
                      padding: '20px', 
                      borderRadius: '15px',
                      border: `2px solid ${hasAlerts ? '#f5c6cb' : '#c3e6cb'}`,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ 
                        fontSize: '1.3rem', 
                        fontWeight: 'bold', 
                        color: hasAlerts ? '#721c24' : '#155724',
                        marginBottom: '15px',
                        textAlign: 'center'
                      }}>
                        👤 {student}
                      </div>
                      
                      <div style={{ 
                        fontSize: '1.8rem', 
                        fontWeight: 'bold', 
                        color: hasAlerts ? '#dc3545' : '#28a745',
                        textAlign: 'center',
                        marginBottom: '15px'
                      }}>
                        {counts.total} Total Alert{counts.total !== 1 ? 's' : ''}
                      </div>
                      
                      {hasAlerts && (
                        <div style={{ fontSize: '0.9rem' }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: '8px',
                            padding: '5px 10px',
                            backgroundColor: counts.left > 0 ? '#fff3cd' : 'transparent',
                            borderRadius: '6px'
                          }}>
                            <span>⬅️ Left:</span>
                            <span style={{ fontWeight: 'bold', color: counts.left > 0 ? '#856404' : '#6c757d' }}>
                              {counts.left} time{counts.left !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: '8px',
                            padding: '5px 10px',
                            backgroundColor: counts.right > 0 ? '#fff3cd' : 'transparent',
                            borderRadius: '6px'
                          }}>
                            <span>➡️ Right:</span>
                            <span style={{ fontWeight: 'bold', color: counts.right > 0 ? '#856404' : '#6c757d' }}>
                              {counts.right} time{counts.right !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: '8px',
                            padding: '5px 10px',
                            backgroundColor: counts.up > 0 ? '#fff3cd' : 'transparent',
                            borderRadius: '6px'
                          }}>
                            <span>⬆️ Up:</span>
                            <span style={{ fontWeight: 'bold', color: counts.up > 0 ? '#856404' : '#6c757d' }}>
                              {counts.up} time{counts.up !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: '8px',
                            padding: '5px 10px',
                            backgroundColor: counts.down > 0 ? '#fff3cd' : 'transparent',
                            borderRadius: '6px'
                          }}>
                            <span>⬇️ Down:</span>
                            <span style={{ fontWeight: 'bold', color: counts.down > 0 ? '#856404' : '#6c757d' }}>
                              {counts.down} time{counts.down !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            marginBottom: '8px',
                            padding: '5px 10px',
                            backgroundColor: counts.tilt > 0 ? '#fff3cd' : 'transparent',
                            borderRadius: '6px'
                          }}>
                            <span>🔄 Tilt:</span>
                            <span style={{ fontWeight: 'bold', color: counts.tilt > 0 ? '#856404' : '#6c757d' }}>
                              {counts.tilt} time{counts.tilt !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}