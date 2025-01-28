import React from "react";
import "./New.css"; 
import { FaLinkedin, FaGithub, FaTwitter } from "react-icons/fa";
import { IoLogoInstagram } from "react-icons/io";
import Profile from "../../assets/kk1.jpg";
import { Link } from "react-router-dom";

const New = () => {
    const toggleDropdown = (isOpen) => {
        const navbar = document.querySelector(".dropdown");
        navbar.style.transform = isOpen ? "translateY(0)" : "translateY(-500px)";
    };

    return (
        <div className="new-container">
            <div className="profile-section">
                <div className="profile-image" data-aos="zoom-in-right" data-aos-duration="2500">
                    <img src={Profile} alt="Kishan Kumar" /> 
                </div>
                <div className="profile-content">
                    <h1 data-aos="fade-left" data-aos-duration="1000" data-aos-delay="800">
                        Hey, I'm <span className="highlight">Kishan Kumar</span>
                    </h1>
                    <div className="role" data-aos="fade-right" data-aos-duration="1000" data-aos-delay="900">
                        I'm a <span>Full Stack Developer</span>
                    </div>
                    <p data-aos="flip-up" data-aos-duration="1000" data-aos-delay="1000">
                        Passionate about building responsive, scalable web applications with engaging user experiences. Experienced in the MERN stack and eager to tackle challenges in software development.
                    </p>
                    <div className="social-links" data-aos="flip-down" data-aos-duration="1000" data-aos-delay="1200">
                        <a href="https://www.linkedin.com/in/kishan-kumar-586b83336?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank" rel="noopener noreferrer">
                            <FaLinkedin />
                        </a>
                        <a href="https://github.com/KumarDevStudio" target="_blank" rel="noopener noreferrer">
                            <FaGithub />
                        </a>
                        <a href="https://x.com/i/flow/login?redirect_after_login=%2Fnameis_kishan" target="_blank" rel="noopener noreferrer">
                            <FaTwitter />
                        </a>
                        <a href="https://www.instagram.com/nameis_kishan?igsh=MTJrcjc0Z2hxODF2bQ==" target="_blank" rel="noopener noreferrer">
                            <IoLogoInstagram />
                        </a>
                    </div>
                    <div className="action-btn" data-aos="zoom-out-left" data-aos-duration="1000" data-aos-delay="1300">
                        <button> <Link to="/resume">My Resume</Link></button>
                    </div> 
                </div>
            </div>
        </div>
    );
};

export default New;

