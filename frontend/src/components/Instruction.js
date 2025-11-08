import React from "react";
import { useNavigate } from "react-router-dom";

export default function Instruction() {
    const [checked, setChecked] = React.useState(false);
    const [, setCurrentStep] = React.useState(0);
    
    const instructions = [
        {
            icon: "📹",
            title: "Webcam Requirements",
            description: "Keep your webcam on at all times during the exam. Ensure your face is clearly visible."
        },
        {
            icon: "🖥️",
            title: "Browser Guidelines",
            description: "Do not refresh or close the browser tab while the exam is in progress."
        },
        {
            icon: "🚫",
            title: "No External Applications",
            description: "Do not open any other tabs, windows, or applications during the exam."
        },
        {
            icon: "🌐",
            title: "Internet Connection",
            description: "Ensure you have a stable internet connection throughout the exam."
        },
        {
            icon: "📱",
            title: "No Mobile Devices",
            description: "No use of mobile phones or other electronic devices is allowed."
        },
        {
            icon: "👤",
            title: "Stay Visible",
            description: "You must remain visible in front of the webcam during the entire exam."
        },
        {
            icon: "⚠️",
            title: "Suspicious Activity",
            description: "Any suspicious activity may result in immediate disqualification."
        },
        {
            icon: "🖥️",
            title: "No Screen Sharing",
            description: "Do not share your screen with anyone during the exam."
        },
        {
            icon: "🔒",
            title: "FullScreen Mode",
            description: "Do not exit FullScreen Mode - it will lead to automatic disqualification."
        },
        {
            icon: "📞",
            title: "Technical Support",
            description: "If you face any technical issues, contact the exam supervisor immediately."
        }
    ];

    const navigate = useNavigate();

    const handleStartExam = () => {
        if (checked) {
            navigate("/exam");
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            padding: "20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        }}>
            <div style={{
                backgroundColor: "white",
                borderRadius: "20px",
                padding: "40px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                maxWidth: "800px",
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
                <div style={{ textAlign: "center", marginBottom: "40px" }}>
                    <div style={{
                        width: "100px",
                        height: "100px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #667eea, #764ba2)",
                        margin: "0 auto 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 10px 20px rgba(102, 126, 234, 0.3)"
                    }}>
                        <span style={{ fontSize: "2.5rem", color: "white" }}>📋</span>
                    </div>
                    <h1 style={{
                        color: "#2c3e50",
                        fontSize: "2.5rem",
                        fontWeight: "bold",
                        margin: "0 0 10px 0"
                    }}>
                        Exam Instructions
                    </h1>
                    <p style={{
                        color: "#7f8c8d",
                        fontSize: "1.1rem",
                        margin: "0"
                    }}>
                        Please read all instructions carefully before starting your exam
                    </p>
                </div>

                {/* Instructions Grid */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: "20px",
                    marginBottom: "30px"
                }}>
                    {instructions.map((instruction, index) => (
                        <div key={index} style={{
                            backgroundColor: "#f8f9fa",
                            borderRadius: "15px",
                            padding: "25px",
                            border: "2px solid #e9ecef",
                            transition: "all 0.3s ease",
                            cursor: "pointer"
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.transform = "translateY(-5px)";
                            e.target.style.boxShadow = "0 10px 20px rgba(0,0,0,0.1)";
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = "translateY(0)";
                            e.target.style.boxShadow = "none";
                        }}
                        onClick={() => setCurrentStep(index)}
                        >
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                marginBottom: "15px"
                            }}>
                                <span style={{
                                    fontSize: "2rem",
                                    marginRight: "15px"
                                }}>
                                    {instruction.icon}
                                </span>
                                <h3 style={{
                                    color: "#2c3e50",
                                    fontSize: "1.2rem",
                                    fontWeight: "bold",
                                    margin: "0"
                                }}>
                                    {instruction.title}
                                </h3>
                            </div>
                            <p style={{
                                color: "#6c757d",
                                fontSize: "1rem",
                                lineHeight: "1.6",
                                margin: "0"
                            }}>
                                {instruction.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Important Notice */}
                <div style={{
                    backgroundColor: "#fff3cd",
                    border: "2px solid #ffeaa7",
                    borderRadius: "15px",
                    padding: "20px",
                    marginBottom: "30px"
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "10px"
                    }}>
                        <span style={{ fontSize: "1.5rem", marginRight: "10px" }}>⚠️</span>
                        <h4 style={{
                            color: "#856404",
                            margin: "0",
                            fontWeight: "bold"
                        }}>
                            Important Notice
                        </h4>
                    </div>
                    <p style={{
                        color: "#856404",
                        margin: "0",
                        fontSize: "1rem"
                    }}>
                        By proceeding with the exam, you acknowledge that you will be monitored by AI proctoring technology. 
                        Any violation of these rules may result in immediate disqualification.
                    </p>
                </div>

                {/* Checkbox */}
                <div style={{
                    backgroundColor: "#f8f9fa",
                    borderRadius: "15px",
                    padding: "25px",
                    marginBottom: "30px",
                    border: "2px solid #e9ecef"
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "15px"
                    }}>
                        <input
                            type="checkbox"
                            id="acknowledge"
                            checked={checked}
                            onChange={() => setChecked(!checked)}
                            style={{
                                width: "20px",
                                height: "20px",
                                cursor: "pointer"
                            }}
                        />
                        <label htmlFor="acknowledge" style={{
                            color: "#2c3e50",
                            fontSize: "1.1rem",
                            fontWeight: "600",
                            cursor: "pointer",
                            margin: "0"
                        }}>
                             I have read and understood all the instructions above
                        </label>
                    </div>
                </div>

                {/* Start Exam Button */}
                <button
                    onClick={handleStartExam}
                    disabled={!checked}
                    style={{
                        width: "100%",
                        padding: "18px",
                        backgroundColor: checked ? "linear-gradient(135deg, #667eea, #764ba2)" : "#95a5a6",
                        color: "white",
                        border: "none",
                        borderRadius: "15px",
                        fontSize: "1.3rem",
                        fontWeight: "bold",
                        cursor: checked ? "pointer" : "not-allowed",
                        transition: "all 0.3s ease",
                        boxShadow: checked ? "0 8px 20px rgba(102, 126, 234, 0.3)" : "none"
                    }}
                    onMouseEnter={(e) => {
                        if (checked) {
                            e.target.style.transform = "translateY(-3px)";
                            e.target.style.boxShadow = "0 12px 25px rgba(102, 126, 234, 0.4)";
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (checked) {
                            e.target.style.transform = "translateY(0)";
                            e.target.style.boxShadow = "0 8px 20px rgba(102, 126, 234, 0.3)";
                        }
                    }}
                >
                    {checked ? (
                        <span> Start Exam Now</span>
                    ) : (
                        <span> Please read all instructions first</span>
                    )}
                </button>

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
                        🔐 AI-powered secure examination system
                    </p>
                </div>
            </div>
        </div>
    );
}