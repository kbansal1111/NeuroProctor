"""
Audio anomaly detection utilities.
Analyzes audio features to detect speech and suspicious sounds.
"""
import threading
from collections import deque
from datetime import datetime
from config import Config

# Thread-safe queue for streaming audio anomaly events (SSE)
audio_event_queue = deque()
audio_queue_lock = threading.Lock()

def analyze_audio_features(audio_features):
    """
    Analyze audio features to detect anomalies.
    
    Args:
        audio_features: Dict containing volume_level, frequency_data, duration
    
    Returns:
        dict: Analysis results with anomaly status and reasons
    """
    # Safely extract features with defaults
    try:
        volume_level = float(audio_features.get('volume_level', 0) or 0)
    except Exception:
        volume_level = 0.0
    
    frequency_data = audio_features.get('frequency_data', []) or []
    try:
        frequency_data = [float(x) for x in frequency_data]
    except Exception:
        frequency_data = []
    
    try:
        duration = float(audio_features.get('duration', 0) or 0)
    except Exception:
        duration = 0.0
    
    # Tunable thresholds
    VOLUME_THRESHOLD = 0.18
    SPEECH_PEAK_THRESHOLD = 0.45
    MIN_SPEECH_PEAKS = 4
    HIGH_VOLUME_THRESHOLD = 0.40
    VERY_HIGH_VOLUME = 0.55
    LOW_VOLUME_PERCENT = 5.0
    HIGH_VOLUME_PERCENT = 35.0
    
    anomaly_detected = False
    anomaly_reasons = []
    
    total_peaks = len(frequency_data)
    speech_peaks = [f for f in frequency_data if f > SPEECH_PEAK_THRESHOLD]
    peak_count = len(speech_peaks)
    peak_ratio = (peak_count / total_peaks) if total_peaks > 0 else 0.0
    
    # Convert to percent for user-friendly thresholds
    vol_pct = volume_level * 100.0
    
    # Primary checks
    if vol_pct < LOW_VOLUME_PERCENT:
        anomaly_detected = True
        anomaly_reasons.append(f"low_volume:{vol_pct:.1f}%")
    elif vol_pct > HIGH_VOLUME_PERCENT:
        anomaly_detected = True
        anomaly_reasons.append(f"high_volume:{vol_pct:.1f}%")
    elif volume_level >= VERY_HIGH_VOLUME:
        anomaly_detected = True
        anomaly_reasons.append(f"very_high_volume:{volume_level:.2f}")
    elif volume_level >= HIGH_VOLUME_THRESHOLD and (peak_count >= MIN_SPEECH_PEAKS or peak_ratio >= 0.10):
        anomaly_detected = True
        anomaly_reasons.append(f"clear_speech:{volume_level:.2f}:{peak_count}")
    elif peak_count >= (MIN_SPEECH_PEAKS + 2) and peak_ratio > 0.12:
        anomaly_detected = True
        anomaly_reasons.append(f"speech_pattern:{peak_count}:{peak_ratio:.2f}")
    elif volume_level >= VOLUME_THRESHOLD * 2 and peak_count >= (MIN_SPEECH_PEAKS - 1):
        anomaly_detected = True
        anomaly_reasons.append(f"short_loud:{volume_level:.2f}")
    
    return {
        'anomaly_detected': anomaly_detected,
        'anomaly_reasons': anomaly_reasons,
        'volume_level': volume_level,
        'peak_count': peak_count,
        'peak_ratio': peak_ratio,
        'total_peaks': total_peaks
    }

def push_audio_event(event):
    """
    Push audio event to queue for SSE streaming.
    
    Args:
        event: Event dict to push to queue
    """
    try:
        with audio_queue_lock:
            audio_event_queue.append(event)
            # Cap queue size
            while len(audio_event_queue) > Config.AUDIO_QUEUE_MAX_SIZE:
                audio_event_queue.popleft()
    except Exception as e:
        print(f"Error pushing audio event to queue: {e}")

def pop_audio_event():
    """
    Pop audio event from queue for SSE streaming.
    
    Returns:
        dict: Event or None if queue is empty
    """
    try:
        with audio_queue_lock:
            if audio_event_queue:
                return audio_event_queue.popleft()
    except Exception as e:
        print(f"Error popping audio event from queue: {e}")
    return None

def clear_audio_queue():
    """Clear all audio events from queue"""
    try:
        with audio_queue_lock:
            audio_event_queue.clear()
        return True
    except Exception as e:
        print(f"Error clearing audio queue: {e}")
        return False
