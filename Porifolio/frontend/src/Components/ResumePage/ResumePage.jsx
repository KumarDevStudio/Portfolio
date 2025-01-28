import React from 'react';
import './ResumePage.css'; 
import { useNavigate } from 'react-router-dom'; 

const ResumePage = () => {
    const navigate = useNavigate();

   
    const handleClose = () => {
        navigate(-1); 
    };

    return (
        <div className="resume-page">
            <h1>My Resume</h1>
            <p>Click the button below to download or view my resume:</p>
            <div className="resume-actions">
               
                <iframe
                    src="src/assets/kishan.pdf"
                    width="100%"
                    height="600px"
                    title="Resume"
                ></iframe>

                <div className="actions">
                  
                    <button className="close-btn" onClick={handleClose}>Back</button>

                  
                    <a href="src/assets/resume.pdf" download="Kishan_Kumar_Resume.pdf">
                        <button className="download-btn">Download Resume</button>
                    </a>
                </div>
            </div>
        </div>
    );
}

export default ResumePage;
