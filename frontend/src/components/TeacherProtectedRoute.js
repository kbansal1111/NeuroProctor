import { Navigate, useLocation } from 'react-router-dom';
import React, { useEffect, useState } from 'react';

export default function TeacherProtectedRoute({ children }) {
    const [valid, setValid] = useState(null); // null=loading, false=not valid, true=valid
    const location = useLocation();

    useEffect(() => {
        const token = localStorage.getItem('teacherAuthToken');
        if (!token) {
            // no token - mark as not valid
            setValid(false);
            return;
        }

        // validate token with backend
        const url = `${window.location.protocol}//${window.location.hostname}:5000/teacher/validate?token=${encodeURIComponent(token)}`;
        fetch(url, { method: 'GET' })
            .then(res => res.json())
            .then(data => {
                if (data && data.valid) {
                    setValid(true);
                } else {
                    // invalidate
                    localStorage.removeItem('teacherAuthToken');
                    localStorage.removeItem('teacherLoggedIn');
                    setValid(false);
                }
            })
            .catch(err => {
                console.error('Teacher token validation failed:', err);
                // On network error, be conservative and mark not valid
                setValid(false);
            });
    }, [location.pathname]);

    if (valid === null) {
        // still validating - render nothing or a light loading state
        return <div style={{ padding: 20 }} className="card">Validating teacher session...</div>;
    }

    if (!valid) {
        return <Navigate to="/teacher/login" replace />;
    }

    return children;
}
