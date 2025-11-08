import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";

export default function Exam() {
  const examRef = useRef(null);
  const navigate = useNavigate();

  // 1. Define questions FIRST
  const questions = useMemo(() => [
        {
          questionText: 'What is the primary purpose of an activation function in a neural network?',
          answerOptions: [
            { answerText: 'Initialize weights', isCorrect: false },
            { answerText: 'Introduce non-linearity', isCorrect: true },
            { answerText: 'Reduce overfitting', isCorrect: false },
            { answerText: 'Normalize inputs', isCorrect: false },
          ],
        },
        {
          questionText: 'What does overfitting mean in machine learning?',
          answerOptions: [
            { answerText: 'Model performs poorly on training data', isCorrect: false },
            { answerText: 'Model performs well on training data but poorly on unseen data', isCorrect: true },
            { answerText: 'Model has no parameters', isCorrect: false },
            { answerText: 'Model always converges faster', isCorrect: false },
          ],
        },
        {
          questionText: 'Which optimizer adapts learning rates per-parameter using estimates of first and second moments?',
          answerOptions: [
            { answerText: 'SGD (Stochastic Gradient Descent)', isCorrect: false },
            { answerText: 'RMSProp', isCorrect: false },
            { answerText: 'Adam', isCorrect: true },
            { answerText: 'Momentum', isCorrect: false },
          ],
        },
        {
          questionText: 'What is the main purpose of batch normalization?',
          answerOptions: [
            { answerText: 'Increase dataset size', isCorrect: false },
            { answerText: 'Normalize inputs of a layer to stabilize and accelerate training', isCorrect: true },
            { answerText: 'Remove irrelevant features', isCorrect: false },
            { answerText: 'Reduce model size', isCorrect: false },
          ],
        },
        {
          questionText: 'In transformer models, what does "self-attention" compute?',
          answerOptions: [
            { answerText: 'A fixed convolution over tokens', isCorrect: false },
            { answerText: 'Relationships and importance between tokens in the same sequence', isCorrect: true },
            { answerText: 'Only positional encodings', isCorrect: false },
            { answerText: 'Data augmentation for text', isCorrect: false },
          ],
        },
        {
          questionText: 'Which architecture is most suitable for processing images?',
          answerOptions: [
            { answerText: 'Recurrent Neural Network (RNN)', isCorrect: false },
            { answerText: 'Convolutional Neural Network (CNN)', isCorrect: true },
            { answerText: 'Transformer for time series only', isCorrect: false },
            { answerText: 'Naive Bayes', isCorrect: false },
          ],
        },
        {
          questionText: 'Which loss function is commonly used for multi-class classification?',
          answerOptions: [
            { answerText: 'Mean Squared Error', isCorrect: false },
            { answerText: 'Binary Cross-Entropy', isCorrect: false },
            { answerText: 'Categorical Cross-Entropy', isCorrect: true },
            { answerText: 'Hinge Loss', isCorrect: false },
          ],
        },
        {
          questionText: 'How do LSTM networks mitigate the vanishing gradient problem?',
          answerOptions: [
            { answerText: 'By using convolutional layers', isCorrect: false },
            { answerText: 'By using gating mechanisms and a memory cell to preserve information', isCorrect: true },
            { answerText: 'By reducing dataset size', isCorrect: false },
            { answerText: 'By using ReLU only', isCorrect: false },
          ],
        },
        {
          questionText: 'What is the likely effect of setting the learning rate too high?',
          answerOptions: [
            { answerText: 'Faster convergence to optimal solution', isCorrect: false },
            { answerText: 'Underfitting due to lack of capacity', isCorrect: false },
            { answerText: 'Training may diverge or become unstable', isCorrect: true },
            { answerText: 'It reduces model complexity', isCorrect: false },
          ],
        },
        {
          questionText: 'What is the purpose of data augmentation in computer vision?',
          answerOptions: [
            { answerText: 'Increase model parameters', isCorrect: false },
            { answerText: 'Reduce dataset variance', isCorrect: false },
            { answerText: 'Increase dataset variety to improve generalization and reduce overfitting', isCorrect: true },
            { answerText: 'Compress images for faster training', isCorrect: false },
          ],
        },
      ], []);

  // 2. Now you can use questions in your hooks
  const [userAnswers, setUserAnswers] = useState(Array(questions.length).fill(null));
  const [score, setScore] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [headAlert, setHeadAlert] = useState("");
  const webcamRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [objectDetectionStatus, setObjectDetectionStatus] = useState("");
  const [audioAlert, setAudioAlert] = useState("");
  const [isAudioMonitoring, setIsAudioMonitoring] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [audioPermission, setAudioPermission] = useState(null);
  const [permissionError, setPermissionError] = useState("");

  // Memoized handleSubmit to avoid useEffect warning
  const handleSubmit = useCallback(() => {
        let newScore = 0;
        userAnswers.forEach((ansIdx, qIdx) => {
            if (
                ansIdx !== null &&
                questions[qIdx].answerOptions[ansIdx].isCorrect
            ) {
                newScore += 1;
            }
        });
        setScore(newScore);
        setSubmitted(true);
    }, [userAnswers, questions]);

  const checkPermissions = async () => {
    setPermissionError("");
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraPermission("granted");
      
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.getTracks().forEach(track => track.stop());
      setAudioPermission("granted");
      
      return true;
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionError("Camera and microphone permissions are required to start the exam. Please allow access and try again.");
        setCameraPermission("denied");
        setAudioPermission("denied");
      } else if (error.name === 'NotFoundError') {
        setPermissionError("Camera or microphone not found. Please ensure your devices are connected.");
        setCameraPermission("not-found");
        setAudioPermission("not-found");
      } else {
        setPermissionError(`Error accessing camera/microphone: ${error.message}`);
        setCameraPermission("error");
        setAudioPermission("error");
      }
      return false;
    }
  };

  const handleStartExam = async () => {
    const hasPermissions = await checkPermissions();
    if (!hasPermissions) {
      return;
    }

    setRegisterError("");
    setRegistering(true);
    const face = webcamRef.current.getScreenshot();
    if (!face) {
      setRegisterError("Could not capture image from webcam.");
      setRegistering(false);
      return;
    }

    // Convert dataURL to Blob
    const blob = await fetch(face).then(res => res.blob());
    const formData = new FormData();
    formData.append("roll_number", rollNumber);
    formData.append("image", blob, "face.jpg");

    // Register face "http://127.0.0.1:5000/register-face"
    const res = await fetch("http://localhost:5000/register-face", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (data.status === "registered") {
      if (examRef.current && document.fullscreenEnabled) {
        await examRef.current.requestFullscreen();
      }
      setStarted(true);
    } else if (data.status === "no_face") {
      setRegisterError("No face detected. Please ensure your face is visible and try again.");
    } else if (data.status === "multiple_faces") {
      setRegisterError("Multiple faces detected. Please ensure only you are visible and try again.");
    } else if (data.status === "poor_quality") {
      setRegisterError(`Face image quality issue: ${data.message}. Please ensure good lighting and a clear view of your face.`);
    } else {
      setRegisterError("Face registration failed. Please try again.");
    }
    setRegistering(false);
  };

  // Now useEffect can safely use handleSubmit
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement && started && !submitted) {
        handleSubmit();
        alert("You exited fullscreen. Exam submitted automatically.");
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [started, submitted, handleSubmit]);

  useEffect(() => {
    checkPermissions();
  }, []);

  const rollNumber = localStorage.getItem("rollNumber");

  const verifyFaceDuringExam = useCallback(async (dataUrl) => {
    try {
      const blob = await fetch(dataUrl).then(res => res.blob());
      const formData = new FormData();
      formData.append("roll_number", rollNumber);
      formData.append("image", blob, "frame.jpg");

      const res = await fetch("http://localhost:5000/verify-face", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.status === "mismatch") {
        // Add a warning first instead of immediately submitting
        const shouldSubmit = window.confirm(
          "⚠️ Face mismatch detected! This might be due to lighting or angle changes. " +
          "Please ensure you are the same person who registered. " +
          "Click OK to submit the exam, or Cancel to continue."
        );
        if (shouldSubmit) {
          handleSubmit();
        }
      } else if (data.status === "multiple_faces") {
        alert("Multiple faces detected! Please ensure only you are visible.");
      } else if (data.status === "no_face") {
        // Don't submit for no face detection, just warn
        console.log("No face detected in current frame");
      }
    } catch (error) {
      console.error("Face verification error:", error);
      // Don't submit on network errors
    }
  }, [rollNumber, handleSubmit]);

  const detectObjectDuringExam = useCallback(async (dataUrl) => {
    try {
      const blob = await fetch(dataUrl).then(res => res.blob());
      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");

      const res = await fetch("http://localhost:5000/detect-object", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      setObjectDetectionStatus(`Last check: ${data.status}`);

      if (data.status === "forbidden_object") {
        alert(`Forbidden object detected: ${data.objects?.join(', ')}. Exam will be submitted.`);
        handleSubmit();
      }
    } catch (error) {
      console.error("Object detection error:", error);
    }
  }, [handleSubmit]);

  // Audio monitoring functions
  const startAudioMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.85;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = stream;
      
      setIsAudioMonitoring(true);
      console.log("Audio monitoring started");
    } catch (error) {
      console.error("Error starting audio monitoring:", error);
      setAudioAlert("⚠️ Microphone access denied. Audio monitoring disabled.");
    }
  }, []);

  const stopAudioMonitoring = useCallback(() => {
    if (microphoneRef.current) {
      microphoneRef.current.getTracks().forEach(track => track.stop());
      microphoneRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsAudioMonitoring(false);
    console.log("Audio monitoring stopped");
  }, []);

  const analyzeAudio = useCallback(async () => {
    if (!analyserRef.current || !isAudioMonitoring || !audioContextRef.current) return;
    
    if (audioContextRef.current.state === 'closed') {
      console.log("AudioContext is closed, stopping audio analysis");
      setIsAudioMonitoring(false);
      return;
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    const squares = Array.from(dataArray).map(x => x * x);
    const rms = Math.sqrt(squares.reduce((sum, val) => sum + val, 0) / bufferLength) / 255;
    
    const speechRangeStart = Math.floor(bufferLength * 0.08);
    const speechRangeEnd = Math.floor(bufferLength * 0.65);
    const frequencyPeaks = [];
    
    for (let i = speechRangeStart; i < speechRangeEnd; i++) {
      if (dataArray[i] > 75) {
        frequencyPeaks.push(dataArray[i] / 255);
      }
    }
    
    const maxAmplitude = Math.max(...dataArray) / 255;
    
    const sortedData = Array.from(dataArray).sort((a, b) => b - a);
    const topFrequencies = sortedData.slice(0, 15).reduce((sum, val) => sum + val, 0) / (15 * 255);
    
    const avgEnergy = sortedData.slice(0, 30).reduce((sum, val) => sum + val, 0) / (30 * 255);

    const volumeLevel = Math.max(rms, topFrequencies, avgEnergy);

    if (volumeLevel > 0.08 || frequencyPeaks.length > 5) {
      console.log(`Audio: Vol=${volumeLevel.toFixed(3)}, Max=${maxAmplitude.toFixed(3)}, Peaks=${frequencyPeaks.length}`);
    }

    try {
      const res = await fetch("http://localhost:5000/detect-audio-anomaly", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: rollNumber,
          audio_features: {
            volume_level: volumeLevel,
            frequency_data: frequencyPeaks,
            duration: 1.0
          }
        })
      });
      
      const data = await res.json();
      
      if (data.status === "anomaly_detected") {
        setAudioAlert(`🔊 ALERT: ${data.anomalies.join(", ")}`);
        console.log("⚠️ Audio anomaly:", data.anomalies);
      } else {
        if (volumeLevel > 0.05) {
          setAudioAlert(`🎤 Monitoring (${(volumeLevel * 100).toFixed(0)}%)`);
        } else {
          setAudioAlert("🔇 Audio monitoring active");
        }
      }
    } catch (error) {
      console.error("Audio analysis error:", error);
    }
  }, [isAudioMonitoring, rollNumber]);

  const sendFrameToBackend = useCallback((dataUrl) => {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const formData = new FormData();
        formData.append('image', blob, 'frame.jpg');
        fetch("http://localhost:5000/detect-head", {
          method: "POST",
          body: formData,
        })
        .then(res => res.json())
        .then(data => {
          setHeadAlert(data.direction);
          if (data.direction.startsWith("ALERT")) {
            const alertData = {
              student_id: rollNumber,
              direction: data.direction,
              time: new Date().toLocaleTimeString()
            };
            fetch("http://localhost:5000/log-alert", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alertData)
            });
          }
        });
      });
  }, [rollNumber]);

  // Timer logic
  useEffect(() => {
      if (!submitted && timeLeft > 0) {
          const timer = setTimeout(() => {
              setTimeLeft(timeLeft - 1);
          }, 1000);
          return () => clearTimeout(timer);
      }
      if (timeLeft === 0 && !submitted) {
          handleSubmit();
      }
  }, [timeLeft, submitted, handleSubmit]);

  // Head movement detection logic
  useEffect(() => {
      if (!started || submitted) return;
      const interval = setInterval(() => {
          if (webcamRef.current) {
              const imageSrc = webcamRef.current.getScreenshot();
              if (imageSrc) {
                  sendFrameToBackend(imageSrc);
              }
          }
      }, 2000);
      return () => clearInterval(interval);
  }, [started, submitted, sendFrameToBackend]);

  // Face verification logic (separate from head movement, less frequent)
  useEffect(() => {
      if (!started || submitted) return;
      const interval = setInterval(() => {
          if (webcamRef.current) {
              const imageSrc = webcamRef.current.getScreenshot();
              if (imageSrc) {
                  verifyFaceDuringExam(imageSrc);
              }
          }
      }, 2000); // Reduced from 3000ms to 2000ms for better face verification
      return () => clearInterval(interval);
  }, [started, submitted, verifyFaceDuringExam]);

  // Object detection logic
  useEffect(() => {
      if (!started || submitted) return;
      const interval = setInterval(() => {
          if (webcamRef.current) {
              const imageSrc = webcamRef.current.getScreenshot();
              if (imageSrc) {
                  detectObjectDuringExam(imageSrc);
              }
          }
      }, 1500); // Reduced from 3000ms to 1500ms for faster object detection
      return () => clearInterval(interval);
  }, [started, submitted, detectObjectDuringExam]);

  // Audio monitoring logic
  useEffect(() => {
      if (started && !submitted) {
          startAudioMonitoring();
      } else if (submitted) {
          stopAudioMonitoring();
      }
      
      return () => {
          stopAudioMonitoring();
      };
  }, [started, submitted, startAudioMonitoring, stopAudioMonitoring]);

  // Audio analysis interval
  useEffect(() => {
      if (!started || submitted || !isAudioMonitoring) return;
      
      const interval = setInterval(() => {
          analyzeAudio();
      }, 2000); // Analyze audio every 2 seconds
      
      return () => clearInterval(interval);
  }, [started, submitted, isAudioMonitoring, analyzeAudio]);

  // Disable copy/paste functionality during exam
  useEffect(() => {
    const handleCopyPaste = (e) => {
      e.preventDefault();
      alert("⚠️ Copy/paste is not allowed during the exam! Please refrain from doing so.");
    };

    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);

    return () => {
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
    };
  }, []);

  // Disable tab switching during exam
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && started && !submitted) {
        alert("⚠️ Tab switching is not allowed during the exam! Please stay focused on the exam tab.");
        // Attempt to re-enter fullscreen mode
        if (examRef.current && document.fullscreenEnabled) {
          examRef.current.requestFullscreen().catch((err) => {
            console.error("Failed to re-enter fullscreen mode:", err);
          });
        }
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && started && !submitted) {
        alert("⚠️ Fullscreen mode is required for the exam! Re-entering fullscreen mode.");
        if (examRef.current && document.fullscreenEnabled) {
          examRef.current.requestFullscreen().catch((err) => {
            console.error("Failed to re-enter fullscreen mode:", err);
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [started, submitted]);

  // Prevent exiting fullscreen during the exam
  useEffect(() => {
    const preventFullscreenExit = (e) => {
      if (!document.fullscreenElement && started && !submitted) {
        e.preventDefault();
        alert("⚠️ Exiting fullscreen is not allowed during the exam! Re-entering fullscreen mode.");
        if (examRef.current && document.fullscreenEnabled) {
          examRef.current.requestFullscreen().catch((err) => {
            console.error("Failed to re-enter fullscreen mode:", err);
          });
        }
      }
    };

    document.addEventListener("fullscreenchange", preventFullscreenExit);

    return () => {
      document.removeEventListener("fullscreenchange", preventFullscreenExit);
    };
  }, [started, submitted]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={examRef} style={{ 
      backgroundColor: '#f8f9fa', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header Warning */}
      <div style={{
        backgroundColor: '#fff3cd',
        border: '2px solid #ffeaa7',
        color: '#856404',
        padding: '15px',
        textAlign: 'center',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        marginBottom: '20px'
      }}>
        ⚠️ Do not exit fullscreen mode. You are being monitored by AI proctoring.
      </div>

      {!started ? (
        // Pre-exam setup
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '70vh',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '40px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            textAlign: 'center',
            maxWidth: '500px',
            width: '100%'
          }}>
            <h1 style={{
              color: '#2c3e50',
              fontSize: '2.5rem',
              fontWeight: 'bold',
              marginBottom: '30px'
            }}>
              📝 Online Examination
            </h1>
            
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={320}
              height={240}
              style={{
                borderRadius: '15px',
                border: '3px solid #e9ecef',
                marginBottom: '20px',
                boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
              }}
            />
            
            <div style={{
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '10px',
              border: '1px solid #dee2e6'
            }}>
              <h3 style={{ color: '#2c3e50', marginBottom: '15px', fontSize: '1.2rem' }}>
                📋 Permission Status
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '10px',
                  backgroundColor: 'white',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontWeight: 'bold' }}>📷 Camera:</span>
                  <span style={{ 
                    color: cameraPermission === 'granted' ? '#28a745' : 
                           cameraPermission === 'denied' ? '#dc3545' : 
                           cameraPermission === null ? '#6c757d' : '#ffc107',
                    fontWeight: 'bold'
                  }}>
                    {cameraPermission === 'granted' ? '✓ Granted' : 
                     cameraPermission === 'denied' ? '✗ Denied' : 
                     cameraPermission === null ? '⏳ Checking...' : '⚠ Error'}
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '10px',
                  backgroundColor: 'white',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontWeight: 'bold' }}>🎤 Microphone:</span>
                  <span style={{ 
                    color: audioPermission === 'granted' ? '#28a745' : 
                           audioPermission === 'denied' ? '#dc3545' : 
                           audioPermission === null ? '#6c757d' : '#ffc107',
                    fontWeight: 'bold'
                  }}>
                    {audioPermission === 'granted' ? '✓ Granted' : 
                     audioPermission === 'denied' ? '✗ Denied' : 
                     audioPermission === null ? '⏳ Checking...' : '⚠ Error'}
                  </span>
                </div>
              </div>
            </div>

            {permissionError && (
              <div style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '20px',
                border: '1px solid #f5c6cb'
              }}>
                ⚠️ {permissionError}
              </div>
            )}
            
            {registerError && (
              <div style={{
                backgroundColor: '#f8d7da',
                color: '#721c24',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '20px',
                border: '1px solid #f5c6cb'
              }}>
                ⚠️ {registerError}
              </div>
            )}
            
            <button 
              onClick={handleStartExam} 
              disabled={registering || cameraPermission !== 'granted' || audioPermission !== 'granted'}
              style={{
                backgroundColor: (registering || cameraPermission !== 'granted' || audioPermission !== 'granted') ? '#95a5a6' : 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '10px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                cursor: (registering || cameraPermission !== 'granted' || audioPermission !== 'granted') ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)'
              }}
            >
              {registering ? "🔄 Registering..." : " Start Exam"}
            </button>

            {(cameraPermission === 'denied' || audioPermission === 'denied' || permissionError) && (
              <button 
                onClick={checkPermissions}
                style={{
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginTop: '15px',
                  transition: 'all 0.3s ease'
                }}
              >
                🔄 Retry Permissions
              </button>
            )}
          </div>
        </div>
      ) : (
        // Exam interface
        <div style={{ display: 'flex', height: 'calc(100vh - 100px)' }}>
          {/* Left: Questions */}
          <div style={{
            flex: '2',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '15px',
            margin: '0 10px',
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
            overflowY: 'auto'
          }}>
            {/* Timer and Progress */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              padding: '20px',
              backgroundColor: '#e3f2fd',
              borderRadius: '10px',
              border: '2px solid #2196f3'
            }}>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: timeLeft < 60 ? '#f44336' : '#1976d2'
              }}>
                Time Left: {formatTime(timeLeft)}
              </div>
              <div style={{
                backgroundColor: '#ff9800',
                color: 'white',
                padding: '8px 15px',
                borderRadius: '20px',
                fontWeight: 'bold'
              }}>
                Question {currentQuestionIndex + 1} of {questions.length}
              </div>
            </div>

            {!submitted ? (
              <>
                {/* Current Question */}
                <div style={{
                  backgroundColor: '#fafafa',
                  padding: '30px',
                  borderRadius: '15px',
                  border: '2px solid #e0e0e0',
                  marginBottom: '30px'
                }}>
                  <h3 style={{
                    color: '#2c3e50',
                    fontSize: '1.3rem',
                    marginBottom: '25px',
                    fontWeight: '600'
                  }}>
                    {questions[currentQuestionIndex].questionText}
                  </h3>
                  
                  {questions[currentQuestionIndex].answerOptions.map((option, oIdx) => (
                    <div key={oIdx} style={{ marginBottom: '15px' }}>
                      <input
                        type="radio"
                        id={`q${currentQuestionIndex}-o${oIdx}`}
                        name={`question-${currentQuestionIndex}`}
                        value={oIdx}
                        checked={userAnswers[currentQuestionIndex] === oIdx}
                        onChange={() => {
                          const updated = [...userAnswers];
                          updated[currentQuestionIndex] = oIdx;
                          setUserAnswers(updated);
                        }}
                        style={{
                          marginRight: '12px',
                          transform: 'scale(1.2)'
                        }}
                      />
                      <label 
                        htmlFor={`q${currentQuestionIndex}-o${oIdx}`}
                        style={{
                          color: '#34495e',
                          fontSize: '1.1rem',
                          cursor: 'pointer',
                          padding: '10px 15px',
                          borderRadius: '8px',
                          backgroundColor: userAnswers[currentQuestionIndex] === oIdx ? '#e8f5e8' : 'transparent',
                          border: userAnswers[currentQuestionIndex] === oIdx ? '2px solid #4caf50' : '1px solid #ddd',
                          transition: 'all 0.3s ease',
                          display: 'inline-block',
                          minWidth: '200px'
                        }}
                      >
                        {option.answerText}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Navigation */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '30px'
                }}>
                  <button 
                    onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                    disabled={currentQuestionIndex === 0}
                    style={{
                      backgroundColor: currentQuestionIndex === 0 ? '#95a5a6' : '#17a2b8',
                      color: 'white',
                      border: 'none',
                      padding: '12px 25px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ⬅️ Previous
                  </button>
                  
                  <span style={{
                    backgroundColor: '#6f42c1',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '20px',
                    fontWeight: 'bold'
                  }}>
                     {currentQuestionIndex + 1} / {questions.length}
                  </span>
                  
                  <button 
                    onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                    disabled={currentQuestionIndex === questions.length - 1}
                    style={{
                      backgroundColor: currentQuestionIndex === questions.length - 1 ? '#95a5a6' : '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '12px 25px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: currentQuestionIndex === questions.length - 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next ➡️
                  </button>
                </div>

                {/* Submit Button */}
                {currentQuestionIndex === questions.length - 1 && (
                  <button 
                    onClick={handleSubmit}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '15px 30px',
                      borderRadius: '10px',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: '0 5px 15px rgba(220, 53, 69, 0.3)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Submit Exam
                  </button>
                )}
              </>
            ) : (
              // Results
              <div style={{
                textAlign: 'center',
                padding: '40px',
                backgroundColor: '#e8f5e8',
                borderRadius: '15px',
                border: '3px solid #4caf50'
              }}>
                <h2 style={{
                  color: '#2e7d32',
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  marginBottom: '20px'
                }}>
                  Exam Completed!
                </h2>
                <div style={{
                  fontSize: '2rem',
                  color: '#1976d2',
                  fontWeight: 'bold',
                  marginBottom: '20px'
                }}>
                  Your Score: <span style={{ color: '#4caf50', fontSize: '3rem' }}>{score}</span> / <span style={{ color: '#ff9800' }}>{questions.length}</span>
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  color: '#666',
                  marginBottom: '30px'
                }}>
                  Percentage: <span style={{ fontWeight: 'bold', color: '#1976d2' }}>{Math.round((score / questions.length) * 100)}%</span>
                </div>
                <button 
                  onClick={() => navigate('/proctor-dashboard')}
                  style={{
                    backgroundColor: '#6f42c1',
                    color: 'white',
                    border: 'none',
                    padding: '15px 30px',
                    borderRadius: '10px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📊 Go to Proctor Dashboard
                </button>
              </div>
            )}
          </div>

          {/* Right: Webcam and Alerts */}
          <div style={{
            flex: '1',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '15px',
            margin: '0 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: '#2c3e50',
              color: 'white',
              padding: '15px',
              borderRadius: '10px',
              marginBottom: '20px',
              textAlign: 'center',
              fontWeight: 'bold',
              width: '100%'
            }}>
             AI Proctoring Active
            </div>
            
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={320}
              height={240}
              style={{
                borderRadius: '15px',
                border: '3px solid #e9ecef',
                marginBottom: '20px',
                boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
              }}
            />
            
            {headAlert && (
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: headAlert.startsWith("ALERT") ? "#dc3545" : "#28a745",
                textAlign: 'center',
                padding: '15px',
                borderRadius: '10px',
                backgroundColor: headAlert.startsWith("ALERT") ? '#f8d7da' : '#d4edda',
                border: `2px solid ${headAlert.startsWith("ALERT") ? '#f5c6cb' : '#c3e6cb'}`,
                marginBottom: '15px',
                width: '100%'
              }}>
                {headAlert}
              </div>
            )}
            
            {objectDetectionStatus && (
              <div style={{
                fontSize: '1rem',
                color: '#6c757d',
                textAlign: 'center',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                width: '100%',
                marginBottom: '15px'
              }}>
                {objectDetectionStatus}
              </div>
            )}
            
            {audioAlert && (
              <div style={{
                fontSize: '1rem',
                fontWeight: 'bold',
                color: audioAlert.startsWith("🔊") ? "#dc3545" : "#28a745",
                textAlign: 'center',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: audioAlert.startsWith("🔊") ? '#f8d7da' : '#d4edda',
                border: `2px solid ${audioAlert.startsWith("🔊") ? '#f5c6cb' : '#c3e6cb'}`,
                width: '100%'
              }}>
                {audioAlert}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}