import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const [username, setUsername] = useState("");
    const [rollNumber, setRollNumber] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        const loginData = { username, rollNumber, password };
        fetch("http://localhost:5000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginData)
        })
        .then(res => res.json())
        .then(data => {
            setIsLoading(false);
            if (data.message === "Login successful") {
                localStorage.setItem("rollNumber", rollNumber);
                navigate("/instruction");
            } else {
                setError("Invalid Credentials");
            }
        })
        .catch(err => {
            setIsLoading(false);
            setError("Network error. Please try again.");
            console.error("Error fetching data:", err);
        });
    };

    return (
        <div className="center" style={{ padding: '40px 20px' }}>
            <div className="card form">
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 60, height: 60, borderRadius: 12, background: 'linear-gradient(90deg, var(--brand-1), var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 28 }}>
                            🎓
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <div className="page-title">AI Proctor Login</div>
                            <div className="muted">Secure student authentication system</div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && <div className="alert danger">{error}</div>}

                    <div className="field">
                        <label>Username</label>
                        <input type="text" placeholder="Enter your username" value={username} onChange={(e)=>setUsername(e.target.value)} />
                    </div>

                    <div className="field">
                        <label>Roll Number</label>
                        <input type="text" placeholder="Enter your roll number" value={rollNumber} onChange={(e)=>setRollNumber(e.target.value)} />
                    </div>

                    <div className="field">
                        <label>Password</label>
                        <input type="password" placeholder="Enter your password" value={password} onChange={(e)=>setPassword(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? 'Logging in...' : 'Login to Exam'}
                        </button>
                        <button type="button" className="btn btn-outline" onClick={()=>navigate('/teacher/login')}>
                            👨‍🏫 Teacher Login
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}