import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { setupKeyboardRestriction, setupTabSwitchDetection } from "../utils/keyboardRestriction";

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
  const eventSourceRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [audioPermission, setAudioPermission] = useState(null);
  const [permissionError, setPermissionError] = useState("");
  const [keyboardWarning, setKeyboardWarning] = useState("");
  const keyboardWarningTimeoutRef = useRef(null);
  const [faceMismatchAlert, setFaceMismatchAlert] = useState("");
  const faceMismatchTimeoutRef = useRef(null);

  const rollNumber = localStorage.getItem("rollNumber");
  const examId = "exam_2025_ai"; // You can make this dynamic

  // Show keyboard warning with auto-dismiss
  const showKeyboardWarning = useCallback((message) => {
    setKeyboardWarning(message);
    if (keyboardWarningTimeoutRef.current) {
      clearTimeout(keyboardWarningTimeoutRef.current);
    }
    keyboardWarningTimeoutRef.current = setTimeout(() => {
      setKeyboardWarning("");
    }, 3000);
  }, []);

  // Show face mismatch alert with auto-dismiss
  const showFaceMismatchAlert = useCallback((message) => {
    setFaceMismatchAlert(message);
    if (faceMismatchTimeoutRef.current) {
      clearTimeout(faceMismatchTimeoutRef.current);
    }
    faceMismatchTimeoutRef.current = setTimeout(() => {
      setFaceMismatchAlert("");
    }, 5000); // Show for 5 seconds
  }, []);

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
    
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError("Your browser does not support camera/microphone access. Please use a modern browser.");
      setCameraPermission("error");
      setAudioPermission("error");
      return false;
    }

    try {
      // Check camera permission
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraPermission("granted");
      } catch (cameraError) {
        console.error("Camera permission error:", cameraError);
        if (cameraError.name === 'NotAllowedError' || cameraError.name === 'PermissionDeniedError') {
          setCameraPermission("denied");
        } else if (cameraError.name === 'NotFoundError') {
          setCameraPermission("not-found");
        } else {
          setCameraPermission("error");
        }
        throw cameraError;
      }
      
      // Check audio permission
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getTracks().forEach(track => track.stop());
        setAudioPermission("granted");
      } catch (audioError) {
        console.error("Audio permission error:", audioError);
        if (audioError.name === 'NotAllowedError' || audioError.name === 'PermissionDeniedError') {
          setAudioPermission("denied");
        } else if (audioError.name === 'NotFoundError') {
          setAudioPermission("not-found");
        } else {
          setAudioPermission("error");
        }
        throw audioError;
      }
      
      return true;
    } catch (error) {
      console.error("Permission check failed:", error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionError("Camera and microphone permissions are required to start the exam. Please allow access and try again.");
      } else if (error.name === 'NotFoundError') {
        setPermissionError("Camera or microphone not found. Please ensure your devices are connected.");
      } else if (error.name === 'NotReadableError') {
        setPermissionError("Camera or microphone is already in use by another application. Please close other applications and try again.");
      } else {
        setPermissionError(`Error accessing camera/microphone: ${error.message || 'Unknown error'}`);
      }
      return false;
    }
  };

  const handleStartExam = async () => {
    const hasPermissions = await checkPermissions();
    if (!hasPermissions) {
      return;
    }

    // Request fullscreen FIRST while still in user gesture context
    let fullscreenRequested = false;
    if (examRef.current && document.fullscreenEnabled) {
      try {
        await examRef.current.requestFullscreen();
        fullscreenRequested = true;
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
        // Continue anyway, fullscreen is not critical
      }
    }

    setRegisterError("");
    setRegistering(true);
    const face = webcamRef.current.getScreenshot();
    if (!face) {
      setRegisterError("Could not capture image from webcam.");
      setRegistering(false);
      // Exit fullscreen if we entered it
      if (fullscreenRequested && document.fullscreenElement) {
        document.exitFullscreen();
      }
      return;
    }

    // Convert dataURL to Blob
    const blob = await fetch(face).then(res => res.blob());
    const formData = new FormData();
    formData.append("roll_number", rollNumber);
    formData.append("exam_id", examId);
    formData.append("image", blob, "face.jpg");

    // Register face "http://127.0.0.1:5000/register-face"
    const res = await fetch("http://localhost:5000/register-face", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (data.status === "registered") {
      try {
        // Reset server-side exam alerts/ufm when this student starts the exam
        await fetch("http://localhost:5000/api/exam/reset", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exam_id: examId })
        });
      } catch (err) {
        console.warn('Exam reset call failed', err);
      }

      setStarted(true);
    } else if (data.status === "no_face") {
      setRegisterError("No face detected. Please ensure your face is visible and try again.");
      // Exit fullscreen if we entered it
      if (fullscreenRequested && document.fullscreenElement) {
        document.exitFullscreen();
      }
    } else if (data.status === "multiple_faces") {
      setRegisterError("Multiple faces detected. Please ensure only you are visible and try again.");
      // Exit fullscreen if we entered it
      if (fullscreenRequested && document.fullscreenElement) {
        document.exitFullscreen();
      }
    } else if (data.status === "poor_quality") {
      setRegisterError(`Face image quality issue: ${data.message}. Please ensure good lighting and a clear view of your face.`);
      // Exit fullscreen if we entered it
      if (fullscreenRequested && document.fullscreenElement) {
        document.exitFullscreen();
      }
    } else {
      setRegisterError("Face registration failed. Please try again.");
      // Exit fullscreen if we entered it
      if (fullscreenRequested && document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
    setRegistering(false);
  };

  // Keyboard restriction and tab switch detection
  useEffect(() => {
    if (!started || submitted) return;

    // Setup keyboard restriction
    const keyboardRestriction = setupKeyboardRestriction({
      studentId: rollNumber,
      examId: examId,
      onShortcutWarning: showKeyboardWarning,
      onKeyAlert: (type) => {
        console.log(`Key alert recorded: ${type}`);
      },
      backendUrl: 'http://localhost:5000'
    });

    // Setup tab switch detection (terminates exam)
    const tabSwitchDetection = setupTabSwitchDetection({
      studentId: rollNumber,
      examId: examId,
      onTabSwitch: () => {
        alert("⚠️ Tab switching detected! Your exam has been automatically submitted.");
        handleSubmit();
      },
      backendUrl: 'http://localhost:5000',
      autoTerminate: true
    });

    // Attach all listeners
    keyboardRestriction.attach();
    tabSwitchDetection.attach();

    // Cleanup on unmount or when exam ends
    return () => {
      keyboardRestriction.detach();
      tabSwitchDetection.detach();
      if (keyboardWarningTimeoutRef.current) {
        clearTimeout(keyboardWarningTimeoutRef.current);
      }
      if (faceMismatchTimeoutRef.current) {
        clearTimeout(faceMismatchTimeoutRef.current);
      }
    };
  }, [started, submitted, rollNumber, examId, handleSubmit, showKeyboardWarning]);

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
        // Send alert to dashboard instead of terminating exam
        const alertData = {
          student_id: rollNumber,
          exam_id: examId,
          direction: "ALERT: Face Mismatch Detected",
          time: new Date().toLocaleTimeString(),
          details: {
            type: "face_mismatch",
            confidence: data.confidence,
            message: "Face verification failed - possible impersonation"
          }
        };
        
        fetch("http://localhost:5000/log-alert", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertData)
        }).catch(err => console.error("Failed to log face mismatch alert:", err));
        
        // Show alert to user
        showFaceMismatchAlert("⚠️ ALERT: Face mismatch detected! Please ensure you are clearly visible.");
        console.warn("⚠️ Face mismatch detected - Alert sent to dashboard");
      } else if (data.status === "multiple_faces") {
        // Send alert for multiple faces
        const alertData = {
          student_id: rollNumber,
          exam_id: examId,
          direction: "ALERT: Multiple Faces Detected",
          time: new Date().toLocaleTimeString(),
          details: {
            type: "multiple_faces",
            message: "More than one person detected in frame"
          }
        };
        
        fetch("http://localhost:5000/log-alert", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertData)
        }).catch(err => console.error("Failed to log multiple faces alert:", err));
        
        // Show alert to user
        showFaceMismatchAlert("⚠️ ALERT: Multiple faces detected! Ensure only you are visible.");
        console.warn("⚠️ Multiple faces detected - Alert sent to dashboard");
      } else if (data.status === "no_face") {
        // Don't submit for no face detection, just warn
        console.log("No face detected in current frame");
      }
    } catch (error) {
      console.error("Face verification error:", error);
      // Don't submit on network errors
    }
  }, [rollNumber, examId, showFaceMismatchAlert]);

  const detectObjectDuringExam = useCallback(async (dataUrl) => {
    try {
      const blob = await fetch(dataUrl).then(res => res.blob());
      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");
      formData.append("student_id", rollNumber);
      formData.append("exam_id", examId);

      const res = await fetch("http://localhost:5000/detect-object", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.status === 'forbidden_object') {
        setObjectDetectionStatus(`⚠️ FORBIDDEN: ${data.objects?.join(', ')}`);
      } else if (data.status === 'clear') {
        setObjectDetectionStatus(`✓ Clear (${data.all_detections?.length || 0} objects)`);
      } else if (data.status === 'error') {
        setObjectDetectionStatus(`Object detection unavailable`);
      }

      if (data.status === "forbidden_object") {
        alert(`Forbidden object detected: ${data.objects?.join(', ')}. Exam will be submitted.`);
        handleSubmit();
      }
    } catch (error) {
      console.error("Object detection error:", error);
      setObjectDetectionStatus("Detection error");
    }
  }, [rollNumber, examId, handleSubmit]);

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

    // volume percent for easy thresholds
    const volPct = volumeLevel * 100;

    // Immediate client-side anomaly checks per user request: <10% or >35% are anomalies
    if (volPct < 10 || volPct > 35) {
      console.log(`Audio (client check) - anomaly by percent: ${volPct.toFixed(1)}% (peaks=${frequencyPeaks.length})`);
      // show immediate UI alert while still sending to backend
      setAudioAlert(`🔊 ALERT: Voice level ${volPct.toFixed(1)}%`);
    } else if (volumeLevel > 0.08 || frequencyPeaks.length > 5) {
      console.log(`Audio: Vol=${volumeLevel.toFixed(3)}, Max=${maxAmplitude.toFixed(3)}, Peaks=${frequencyPeaks.length}`);
    }

    try {
      // Send compact features to backend for analysis
      const payload = {
        student_id: rollNumber,
        audio_features: {
          volume_level: volumeLevel,
          // send small set of peaks (floats between 0-1)
          frequency_data: frequencyPeaks.slice(0, 40),
          duration: 1.0
        }
      };

      const res = await fetch("http://localhost:5000/detect-audio-anomaly", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      // backend returns anomaly_reasons when anomaly detected
      if (data.status === "anomaly_detected") {
        const reasons = data.anomaly_reasons || data.anomalies || [];
        setAudioAlert(`🔊 ALERT: ${reasons.join(", ")}`);
        console.log("⚠️ Audio anomaly detected:", reasons, payload);
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

  // Server-Sent Events connection to receive real-time audio anomaly events from backend
  useEffect(() => {
    if (!started || submitted) return;

    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      const es = new EventSource('http://localhost:5000/stream-audio-anomaly');
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (!payload) return;
          // only show events for this student
          if (payload.student_id && payload.student_id !== rollNumber) return;
          if (payload.status === 'anomaly_detected') {
            const reasons = payload.anomaly_reasons || [];
            setAudioAlert(`🔊 ALERT (server): ${reasons.join(', ')}`);
            // Optionally, flash other UI indicators here
          } else if (payload.status === 'clear') {
            // show monitoring state but don't override stronger alerts
            setAudioAlert(prev => (prev && prev.startsWith('🔊') ? prev : `🔇 Audio OK (${Math.round((payload.volume_level || 0) * 100)}%)`));
          }
        } catch (err) {
          console.error('SSE parse error', err);
        }
      };

      es.onerror = (err) => {
        console.warn('EventSource error', err);
        // reconnect logic: close and try again later
        try { es.close(); } catch (e) {}
        eventSourceRef.current = null;
        setTimeout(() => {
          if (!eventSourceRef.current && started && !submitted) {
            try {
              eventSourceRef.current = new EventSource('http://localhost:5000/stream-audio-anomaly');
            } catch (e) {}
          }
        }, 3000);
      };
    } catch (e) {
      console.warn('SSE setup failed', e);
    }

    return () => {
      if (eventSourceRef.current) {
        try { eventSourceRef.current.close(); } catch (e) {}
        eventSourceRef.current = null;
      }
    };
  }, [started, submitted, rollNumber]);

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

  // Timer logic
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={examRef} className="exam-page">
      {/* Keyboard Warning Alert */}
      {keyboardWarning && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          backgroundColor: '#ff9800',
          color: 'white',
          padding: '15px 30px',
          borderRadius: '10px',
          boxShadow: '0 5px 20px rgba(255, 152, 0, 0.5)',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          textAlign: 'center',
          minWidth: '400px',
          animation: 'slideDown 0.3s ease'
        }}>
          {keyboardWarning}
        </div>
      )}

      {/* Face Mismatch Alert */}
      {faceMismatchAlert && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          backgroundColor: '#dc3545',
          color: 'white',
          padding: '15px 30px',
          borderRadius: '10px',
          boxShadow: '0 5px 20px rgba(220, 53, 69, 0.5)',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          textAlign: 'center',
          minWidth: '400px',
          animation: 'slideDown 0.3s ease',
          border: '2px solid #fff'
        }}>
          {faceMismatchAlert}
        </div>
      )}

      {/* Header Warning - fixed and high z-index so it remains visible (including in fullscreen) */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        backgroundColor: '#fff3cd',
        borderBottom: '2px solid #ffeaa7',
        color: '#856404',
        padding: '12px 16px',
        textAlign: 'center',
        fontSize: '1.05rem',
        fontWeight: '700',
        zIndex: 1100, /* lower than header so nav remains on top */
        boxShadow: '0 3px 10px rgba(0,0,0,0.12)'
      }} aria-live="polite">
        ⚠️ Do not exit fullscreen mode. You are being monitored by AI proctoring.
      </div>

      {/* spacer so page content isn't covered by the fixed header */}
  <div style={{ height: '64px' }} />

      {!started ? (
        // Pre-exam setup
        <div className="exam-setup">
          <div className="exam-setup-card">
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
              className="exam-webcam"
            />
            
            <div className="permission-box">
              <h3 style={{ color: '#2c3e50', marginBottom: '15px', fontSize: '1.2rem' }}>
                📋 Permission Status
              </h3>
              <div className="permission-list">
                <div className="permission-item">
                  <span style={{ fontWeight: '700' }}>📷 Camera:</span>
                  <span style={{ color: cameraPermission === 'granted' ? 'var(--success)' : cameraPermission === 'denied' ? 'var(--danger)' : '#6c757d', fontWeight: '700' }}>
                    {cameraPermission === 'granted' ? '✓ Granted' : cameraPermission === 'denied' ? '✗ Denied' : cameraPermission === null ? '⏳ Checking...' : '⚠ Error'}
                  </span>
                </div>
                <div className="permission-item">
                  <span style={{ fontWeight: '700' }}>🎤 Microphone:</span>
                  <span style={{ color: audioPermission === 'granted' ? 'var(--success)' : audioPermission === 'denied' ? 'var(--danger)' : '#6c757d', fontWeight: '700' }}>
                    {audioPermission === 'granted' ? '✓ Granted' : audioPermission === 'denied' ? '✗ Denied' : audioPermission === null ? '⏳ Checking...' : '⚠ Error'}
                  </span>
                </div>
              </div>
            </div>

            {permissionError && (
              <div className="register-error">⚠️ {permissionError}</div>
            )}
            
            {registerError && (
              <div className="register-error" style={{ 
                backgroundColor: '#dc3545',
                color: 'white',
                fontWeight: '700'
              }}>⚠️ {registerError}</div>
            )}
            
            <button
              onClick={handleStartExam}
              disabled={registering || cameraPermission !== 'granted' || audioPermission !== 'granted'}
              className="exam-start-btn btn-primary"
              style={{ background: (registering || cameraPermission !== 'granted' || audioPermission !== 'granted') ? '#95a5a6' : undefined }}
            >
              {registering ? "🔄 Registering..." : "Start Exam"}
            </button>

            {(cameraPermission === 'denied' || audioPermission === 'denied' || permissionError) && (
              <button onClick={checkPermissions} className="exam-start-btn btn-outline" style={{ marginTop: 12, background: 'transparent' }}>🔄 Retry Permissions</button>
            )}
          </div>
        </div>
      ) : (
        // Exam interface
        <div className="exam-grid">
          {/* Left: Questions */}
          <div className="exam-left">
            <div className="card" style={{ padding: '20px', overflowY: 'auto' }}>
            {/* Timer and Progress */}
            <div className="exam-controls">
              <div className="timer-box" style={{ color: timeLeft < 60 ? '#fff' : undefined }}>Time Left: {formatTime(timeLeft)}</div>
              <div className="progress-badge">Question {currentQuestionIndex + 1} of {questions.length}</div>
            </div>

            {!submitted ? (
              <>
                {/* Current Question */}
                <div className="question-card">
                  <h3 style={{
                    color: '#2c3e50',
                    fontSize: '1.3rem',
                    marginBottom: '25px',
                    fontWeight: '600'
                  }}>
                    {questions[currentQuestionIndex].questionText}
                  </h3>
                  
                  {questions[currentQuestionIndex].answerOptions.map((option, oIdx) => (
                    <div key={oIdx} style={{ marginBottom: '12px' }}>
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
                        style={{ marginRight: '12px', transform: 'scale(1.15)' }}
                      />
                      <label
                        htmlFor={`q${currentQuestionIndex}-o${oIdx}`}
                        className="answer-option"
                        style={{
                          backgroundColor: userAnswers[currentQuestionIndex] === oIdx ? '#e8f5e8' : 'transparent',
                          border: userAnswers[currentQuestionIndex] === oIdx ? '2px solid #4caf50' : '1px solid #ddd'
                        }}
                      >
                        {option.answerText}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Navigation */}
                <div className="nav-buttons">
                  <button onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))} disabled={currentQuestionIndex === 0} className="btn" style={{ background: currentQuestionIndex === 0 ? '#95a5a6' : undefined }}>⬅️ Previous</button>

                  <span style={{ backgroundColor: '#6f42c1', color: 'white', padding: '10px 20px', borderRadius: '20px', fontWeight: '700' }}>{currentQuestionIndex + 1} / {questions.length}</span>

                  <button onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))} disabled={currentQuestionIndex === questions.length - 1} className="btn" style={{ background: currentQuestionIndex === questions.length - 1 ? '#95a5a6' : undefined }}>Next ➡️</button>
                </div>

                {/* Submit Button */}
                {currentQuestionIndex === questions.length - 1 && (
                  <button onClick={handleSubmit} className="exam-start-btn btn-danger" style={{ width: 'auto', padding: '12px 28px' }}>Submit Exam</button>
                )}
              </>
            ) : (
              // Results
              <div className="result-card">
                <h2 style={{
                  color: '#2e7d32',
                  fontSize: '2.5rem',
                  fontWeight: 'bold',
                  marginBottom: '20px'
                }}>
                  Exam Completed!
                </h2>
                <div style={{ fontSize: '2rem', color: '#1976d2', fontWeight: '700', marginBottom: '20px' }}>Your Score: <span style={{ color: '#4caf50', fontSize: '3rem' }}>{score}</span> / <span style={{ color: '#ff9800' }}>{questions.length}</span></div>
                <div style={{
                  fontSize: '1.5rem',
                  color: '#666',
                  marginBottom: '30px'
                }}>
                  Percentage: <span style={{ fontWeight: 'bold', color: '#1976d2' }}>{Math.round((score / questions.length) * 100)}%</span>
                </div>
                <div style={{
                  backgroundColor: '#e3f2fd',
                  padding: '20px',
                  borderRadius: '10px',
                  textAlign: 'center'
                }}>
                  <p style={{ 
                    fontSize: '1.1rem',
                    color: '#1976d2',
                    margin: '0'
                  }}>
                    ✅ Your exam has been submitted successfully!
                  </p>
                  <p style={{ 
                    fontSize: '0.95rem',
                    color: '#666',
                    marginTop: '10px'
                  }}>
                    You may now close this window.
                  </p>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Right: Webcam and Alerts */}
          <div className="exam-right">
            <div className="card" style={{ padding: '20px' }}>
            <div className="proctor-badge">AI Proctoring Active</div>
            
            <div className="exam-webcam-card">
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" width={320} height={240} className="exam-webcam" />
            </div>
            
            {headAlert && (
              <div className="alert-card" style={{ background: headAlert.startsWith("ALERT") ? '#f8d7da' : '#d4edda', border: `2px solid ${headAlert.startsWith("ALERT") ? '#f5c6cb' : '#c3e6cb'}`, color: headAlert.startsWith("ALERT") ? 'var(--danger)' : 'var(--success)' }}>{headAlert}</div>
            )}
            
            {objectDetectionStatus && (
              <div className="alert-card" style={{ background: '#f8f9fa', border: '1px solid #dee2e6', color: '#6c757d' }}>{objectDetectionStatus}</div>
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
        </div>
      )}
    </div>
  );
}