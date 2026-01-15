"""
Alert and exam management routes.
Handles alert logging, exam alerts, terminations, resets, and unfair means marking.
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from database import get_db
from backend_utils.audio_detection import clear_audio_queue

# Create blueprint
alerts_bp = Blueprint('alerts', __name__)

# In-memory storage for UFM data (fallback)
ufm_storage = []

@alerts_bp.route('/log-alert', methods=['POST'])
def log_alert():
    """Log a proctoring alert"""
    data = request.get_json()
    student_id = data.get('student_id')
    direction = data.get('direction')
    time = data.get('time')
    exam_id = data.get('exam_id', 'exam_2025_ai')
    
    if student_id and direction and time:
        database = get_db()
        if database is not None:
            try:
                alert_doc = {
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "direction": direction,
                    "alert_time": datetime.now(),
                    "details": data,
                    "created_at": datetime.now()
                }
                database.alerts.insert_one(alert_doc)
                return jsonify({'status': 'ok'})
            except Exception as e:
                print(f"Database logging error: {e}")
                return jsonify({'status': 'error', 'message': 'Database error'}), 500
        else:
            return jsonify({'status': 'error', 'message': 'Database connection failed'}), 500
    return jsonify({'status': 'error', 'message': 'Missing data'}), 400

@alerts_bp.route('/alerts', methods=['GET'])
def get_alerts():
    """Get all alerts"""
    database = get_db()
    if database is not None:
        try:
            alerts_cursor = database.alerts.find().sort("alert_time", -1)
            
            alerts = []
            for alert in alerts_cursor:
                alerts.append({
                    'student_id': alert.get('student_id'),
                    'direction': alert.get('direction'),
                    'alert_time': alert.get('alert_time').isoformat() if alert.get('alert_time') else None,
                    'details': alert.get('details', {})
                })
            
            return jsonify(alerts)
        except Exception as e:
            print(f"Database fetch error: {e}")
            return jsonify({'error': 'Database error'}), 500
    else:
        return jsonify({'error': 'Database connection failed'}), 500

@alerts_bp.route('/api/exam/alert', methods=['POST'])
def record_exam_alert():
    """Record generic keyboard/interaction alerts during exam"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400
        
        student_id = data.get('student_id')
        exam_id = data.get('exam_id')
        alert_type = data.get('alert_type')
        timestamp = data.get('timestamp')
        message = data.get('message', '')
        
        if not all([student_id, exam_id, alert_type]):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields'
            }), 400
        
        database = get_db()
        if database is not None:
            try:
                alert_doc = {
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "alert_type": alert_type,
                    "message": message,
                    "timestamp": timestamp,
                    "created_at": datetime.now()
                }
                database.exam_alerts.insert_one(alert_doc)
                
                return jsonify({
                    'status': 'success',
                    'message': 'Alert recorded'
                })
            except Exception as e:
                print(f"Error recording exam alert: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Database error: {str(e)}'
                }), 500
        else:
            return jsonify({
                'status': 'error',
                'message': 'Database connection failed'
            }), 500
            
    except Exception as e:
        print(f"Error in record_exam_alert: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

@alerts_bp.route('/api/exam/terminate', methods=['POST'])
def record_exam_termination():
    """Record exam termination event"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400
        
        student_id = data.get('student_id')
        exam_id = data.get('exam_id')
        reason = data.get('reason')
        timestamp = data.get('timestamp')
        
        if not all([student_id, exam_id, reason]):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields'
            }), 400
        
        database = get_db()
        if database is not None:
            try:
                termination_doc = {
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "reason": reason,
                    "timestamp": timestamp,
                    "created_at": datetime.now()
                }
                database.exam_terminations.insert_one(termination_doc)
                
                # Also log as a critical alert
                alert_doc = {
                    "student_id": student_id,
                    "direction": f"EXAM TERMINATED: {reason}",
                    "alert_time": datetime.now(),
                    "details": {
                        "type": "exam_termination",
                        "reason": reason,
                        "exam_id": exam_id,
                        "time": datetime.now().isoformat()
                    },
                    "created_at": datetime.now()
                }
                database.alerts.insert_one(alert_doc)
                
                print(f"Exam terminated for student {student_id}: {reason}")
                
                return jsonify({
                    'status': 'success',
                    'message': 'Termination recorded'
                })
            except Exception as e:
                print(f"Error recording exam termination: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Database error: {str(e)}'
                }), 500
        else:
            return jsonify({
                'status': 'error',
                'message': 'Database connection failed'
            }), 500
            
    except Exception as e:
        print(f"Error in record_exam_termination: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

@alerts_bp.route('/api/exam/reset', methods=['POST'])
def reset_exam_data():
    """Reset alerts and unfair-means data for an exam"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No JSON payload received'}), 400

        exam_id = data.get('exam_id')
        student_id = data.get('student_id')
        legacy_cleanup = bool(data.get('include_legacy', True))
        
        if not exam_id:
            return jsonify({'status': 'error', 'message': 'Missing exam_id'}), 400

        database = get_db()
        removed = {}
        errors = []

        if database is not None:
            try:
                def with_legacy_support(base_filter):
                    if not legacy_cleanup or 'exam_id' not in base_filter:
                        return base_filter
                    alt = dict(base_filter)
                    alt.pop('exam_id', None)
                    variants = [base_filter]
                    for legacy_value in ({'$exists': False}, '', None):
                        legacy_clause = dict(alt)
                        legacy_clause['exam_id'] = legacy_value
                        variants.append(legacy_clause)
                    return {'$or': variants}

                # Build query filters
                ufm_filter = {'exam_id': exam_id}
                exam_alerts_filter = {'exam_id': exam_id}
                generic_alerts_filter = {'exam_id': exam_id}
                faces_filter = {'exam_id': exam_id}
                
                if student_id:
                    ufm_filter['student_id'] = student_id
                    exam_alerts_filter['student_id'] = student_id
                    generic_alerts_filter['student_id'] = student_id
                    faces_filter['roll_number'] = student_id
                
                # Remove UFM entries
                try:
                    if 'unfair_means' in database.list_collection_names():
                        res_ufm = database.unfair_means.delete_many(with_legacy_support(ufm_filter))
                        removed['ufm_removed'] = res_ufm.deleted_count
                    else:
                        removed['ufm_removed'] = 0
                except Exception as e:
                    errors.append(f"UFM deletion error: {str(e)}")
                    removed['ufm_removed'] = 0

                # Remove exam alerts
                try:
                    if 'exam_alerts' in database.list_collection_names():
                        res_ea = database.exam_alerts.delete_many(with_legacy_support(exam_alerts_filter))
                        removed['exam_alerts_removed'] = res_ea.deleted_count
                    else:
                        removed['exam_alerts_removed'] = 0
                except Exception as e:
                    errors.append(f"Exam alerts deletion error: {str(e)}")
                    removed['exam_alerts_removed'] = 0

                # Remove exam terminations
                try:
                    if 'exam_terminations' in database.list_collection_names():
                        res_et = database.exam_terminations.delete_many(with_legacy_support(exam_alerts_filter))
                        removed['exam_terminations_removed'] = res_et.deleted_count
                    else:
                        removed['exam_terminations_removed'] = 0
                except Exception as e:
                    errors.append(f"Exam terminations deletion error: {str(e)}")
                    removed['exam_terminations_removed'] = 0

                # Remove alerts
                try:
                    if 'alerts' in database.list_collection_names():
                        res_alerts = database.alerts.delete_many(with_legacy_support(generic_alerts_filter))
                        removed['alerts_removed'] = res_alerts.deleted_count
                    else:
                        removed['alerts_removed'] = 0
                except Exception as e:
                    errors.append(f"Alerts deletion error: {str(e)}")
                    removed['alerts_removed'] = 0

                # Remove registered faces
                try:
                    if 'registered_faces' in database.list_collection_names():
                        res_faces = database.registered_faces.delete_many(with_legacy_support(faces_filter))
                        removed['registered_faces_removed'] = res_faces.deleted_count
                    else:
                        removed['registered_faces_removed'] = 0
                except Exception as e:
                    errors.append(f"Registered faces deletion error: {str(e)}")
                    removed['registered_faces_removed'] = 0

            except Exception as e:
                print(f"Error clearing DB exam data: {e}")
                return jsonify({'status': 'error', 'message': f'Database error: {str(e)}'}), 500
        else:
            # In-memory fallback
            before_ufm = len(ufm_storage)
            if student_id:
                ufm_storage[:] = [u for u in ufm_storage if not (u.get('exam_id') == exam_id and u.get('student_id') == student_id)]
            else:
                ufm_storage[:] = [u for u in ufm_storage if u.get('exam_id') != exam_id]
            after_ufm = len(ufm_storage)
            removed['ufm_removed'] = before_ufm - after_ufm
            removed['exam_alerts_removed'] = 0
            removed['exam_terminations_removed'] = 0
            removed['alerts_removed'] = 0
            removed['registered_faces_removed'] = 0

        # Clear audio event queue
        if clear_audio_queue():
            removed['audio_queue_cleared'] = True
        else:
            removed['audio_queue_cleared'] = False
            errors.append("Audio queue clear error")

        if errors:
            return jsonify({
                'status': 'error',
                'message': 'Reset partially failed',
                'removed': removed,
                'errors': errors
            }), 500

        total_removed = sum(removed.get(k, 0) for k in removed if k != 'audio_queue_cleared')
        summary = f"Reset exam {exam_id}: {total_removed} records removed, audio queue cleared."
        return jsonify({'status': 'success', 'removed': removed, 'summary': summary})
        
    except Exception as e:
        print(f"Error in reset_exam_data: {e}")
        return jsonify({'status': 'error', 'message': f'Server error: {str(e)}'}), 500

@alerts_bp.route('/api/ufm', methods=['POST'])
def mark_unfair_means():
    """Mark a student for unfair means"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400
        
        student_id = data.get('student_id')
        exam_id = data.get('exam_id')
        reason = data.get('reason', 'Marked for unfair means by proctor')
        proctor_id = data.get('proctor_id', 'system')
        
        if not all([student_id, exam_id]):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: student_id and exam_id'
            }), 400
        
        database = get_db()
        if database is not None:
            try:
                if 'unfair_means' not in database.list_collection_names():
                    database.create_collection('unfair_means')
                
                existing_ufm = database.unfair_means.find_one({
                    "student_id": student_id,
                    "exam_id": exam_id
                })
                
                if existing_ufm:
                    return jsonify({
                        'status': 'error',
                        'message': 'Student already marked for unfair means in this exam'
                    }), 409
                
                ufm_doc = {
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "reason": reason,
                    "proctor_id": proctor_id,
                    "marked_at": datetime.now(),
                    "status": "marked",
                    "created_at": datetime.now()
                }
                database.unfair_means.insert_one(ufm_doc)
                
                # Also log as critical alert
                alert_doc = {
                    "student_id": student_id,
                    "direction": f"UNFAIR MEANS: {reason}",
                    "alert_time": datetime.now(),
                    "details": {
                        "type": "unfair_means",
                        "reason": reason,
                        "proctor_id": proctor_id,
                        "exam_id": exam_id,
                        "time": datetime.now().isoformat()
                    },
                    "created_at": datetime.now()
                }
                database.alerts.insert_one(alert_doc)
                
                print(f"Student {student_id} marked for unfair means: {reason}")
                
                return jsonify({
                    'status': 'success',
                    'message': 'Student marked for unfair means',
                    'student_id': student_id,
                    'exam_id': exam_id
                })
            except Exception as e:
                print(f"Error marking student for unfair means: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Database error: {str(e)}'
                }), 500
        else:
            # In-memory fallback
            existing_ufm = next((ufm for ufm in ufm_storage if ufm['student_id'] == student_id and ufm['exam_id'] == exam_id), None)
            if existing_ufm:
                return jsonify({
                    'status': 'error',
                    'message': 'Student already marked for unfair means in this exam'
                }), 409
            
            ufm_doc = {
                "student_id": student_id,
                "exam_id": exam_id,
                "reason": reason,
                "proctor_id": proctor_id,
                "marked_at": datetime.now().isoformat(),
                "status": "marked",
                "created_at": datetime.now().isoformat()
            }
            ufm_storage.append(ufm_doc)
            
            return jsonify({
                'status': 'success',
                'message': 'Student marked for unfair means',
                'student_id': student_id,
                'exam_id': exam_id
            })
            
    except Exception as e:
        print(f"Error in mark_unfair_means: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

@alerts_bp.route('/api/ufm/<exam_id>', methods=['GET'])
def get_ufm_students(exam_id):
    """Get all students marked for unfair means in a specific exam"""
    try:
        database = get_db()
        if database is not None:
            try:
                ufm_students = list(database.unfair_means.find(
                    {"exam_id": exam_id},
                    {"_id": 0}
                ).sort("marked_at", -1))
                
                return jsonify({
                    'status': 'success',
                    'ufm_students': ufm_students
                })
            except Exception as e:
                print(f"Error fetching UFM students: {e}")
                return jsonify({
                    'status': 'error',
                    'message': f'Database error: {str(e)}'
                }), 500
        else:
            # In-memory fallback
            ufm_students = [ufm for ufm in ufm_storage if ufm['exam_id'] == exam_id]
            ufm_students.sort(key=lambda x: x.get('marked_at', ''), reverse=True)
            
            return jsonify({
                'status': 'success',
                'ufm_students': ufm_students
            })
            
    except Exception as e:
        print(f"Error in get_ufm_students: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500
