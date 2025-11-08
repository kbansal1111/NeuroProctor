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
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px"
        }}>
            <div style={{
                backgroundColor: "white",
                borderRadius: "20px",
                padding: "40px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                maxWidth: "450px",
                width: "100%",
                position: "relative",
                overflow: "hidden"
            }}>
                {/* Background Pattern */}
                <div style={{
                    position: "absolute",
                    top: "-50px",
                    right: "-50px",
                    width: "100px",
                    height: "100px",
                    borderRadius: "50%",
                    background: "linear-gradient(45deg, #667eea, #764ba2)",
                    opacity: "0.1"
                }}></div>
                
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "30px" }}>
                    <div style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #667eea, #764ba2)",
                        margin: "0 auto 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 10px 20px rgba(102, 126, 234, 0.3)"
                    }}>
                        <span style={{ fontSize: "2rem", color: "white" }}>🎓</span>
                    </div>
                    <h1 style={{
                        color: "#2c3e50",
                        fontSize: "2.2rem",
                        fontWeight: "bold",
                        margin: "0 0 10px 0"
                    }}>
                        AI Proctor Login
                    </h1>
                    <p style={{
                        color: "#7f8c8d",
                        fontSize: "1rem",
                        margin: "0"
                    }}>
                        Secure student authentication system
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    {error && (
                        <div style={{
                            backgroundColor: "#f8d7da",
                            color: "#721c24",
                            padding: "12px",
                            borderRadius: "8px",
                            marginBottom: "20px",
                            border: "1px solid #f5c6cb",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}>
                            <span>⚠️</span>
                            {error}
                        </div>
                    )}

                    <div style={{ marginBottom: "20px" }}>
                        <label style={{
                            display: "block",
                            marginBottom: "8px",
                            color: "#2c3e50",
                            fontWeight: "600",
                            fontSize: "0.9rem"
                        }}>
                            👤 Username
                        </label>
                        <input
                            type="text"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "15px",
                                border: "2px solid #e9ecef",
                                borderRadius: "10px",
                                fontSize: "1rem",
                                transition: "border-color 0.3s ease",
                                boxSizing: "border-box"
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#667eea"}
                            onBlur={(e) => e.target.style.borderColor = "#e9ecef"}
                        />
                    </div>

                    <div style={{ marginBottom: "20px" }}>
                        <label style={{
                            display: "block",
                            marginBottom: "8px",
                            color: "#2c3e50",
                            fontWeight: "600",
                            fontSize: "0.9rem"
                        }}>
                            🆔 Roll Number
                        </label>
                        <input
                            type="text"
                            placeholder="Enter your roll number"
                            value={rollNumber}
                            onChange={(e) => setRollNumber(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "15px",
                                border: "2px solid #e9ecef",
                                borderRadius: "10px",
                                fontSize: "1rem",
                                transition: "border-color 0.3s ease",
                                boxSizing: "border-box"
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#667eea"}
                            onBlur={(e) => e.target.style.borderColor = "#e9ecef"}
                        />
                    </div>

                    <div style={{ marginBottom: "30px" }}>
                        <label style={{
                            display: "block",
                            marginBottom: "8px",
                            color: "#2c3e50",
                            fontWeight: "600",
                            fontSize: "0.9rem"
                        }}>
                            🔒 Password
                        </label>
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "15px",
                                border: "2px solid #e9ecef",
                                borderRadius: "10px",
                                fontSize: "1rem",
                                transition: "border-color 0.3s ease",
                                boxSizing: "border-box"
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#667eea"}
                            onBlur={(e) => e.target.style.borderColor = "#e9ecef"}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: "100%",
                            padding: "15px",
                            backgroundColor: isLoading ? "#506668ff" : "linear-gradient(135deg, #667eea, #764ba2)",
                            color: "#7a4747",
                            border: "none",
                            borderRadius: "10px",
                            fontSize: "1.1rem",
                            fontWeight: "bold",
                            cursor: isLoading ? "not-allowed" : "pointer",
                            transition: "all 0.3s ease",
                            boxShadow: "0 5px 15px rgba(102, 126, 234, 0.3)"
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading) {
                                e.target.style.transform = "translateY(-2px)";
                                e.target.style.boxShadow = "0 8px 20px rgba(102, 126, 234, 0.4)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isLoading) {
                                e.target.style.transform = "translateY(0)";
                                e.target.style.boxShadow = "0 5px 15px rgba(102, 126, 234, 0.3)";
                            }
                        }}
                    >
                        {isLoading ? (
                            <span>🔄 Logging in...</span>
                        ) : (
                            <span> Login to Exam</span>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div style={{
                    textAlign: "center",
                    marginTop: "30px",
                    paddingTop: "20px",
                    borderTop: "1px solid #e9ecef"
                }}>
                    <p style={{
                        color: "#7f8c8d",
                        fontSize: "0.9rem",
                        margin: "0"
                    }}>
                        🔐 Secure AI-powered proctoring system
                    </p>
                </div>
            </div>
        </div>
    );
}