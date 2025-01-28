import React, { useState } from 'react';
import axios from 'axios';
import { FaLinkedin, FaGithub, FaTwitter } from 'react-icons/fa';
import './Footer.css';
import { FaArrowRight } from "react-icons/fa6";
import { IoLogoInstagram } from "react-icons/io5";


const Footer = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [isPopupVisible, setIsPopupVisible] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubscribe = async () => {
    if (!email) {
      showPopup('Email is required.');
      return;
    }

    if (!validateEmail(email)) {
      showPopup('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setPopupMessage('');

    try {
      const response = await axios.post('http://localhost:5000/api/subscribe', { email });
      showPopup(response.data.message || 'Subscribed successfully!');
      setEmail('');
    } catch (error) {
      showPopup(error.response?.data?.error || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showPopup = (message) => {
    setPopupMessage(message);
    setIsPopupVisible(true);
    setTimeout(() => {
      setIsPopupVisible(false);
    }, 3000);
  };

  return (
    <div className="footer">
      <div className="footer-top">
        <div className="footer-about">
          <h4 data-aos="zoom-out" data-aos-duration="1000" data-aos-delay="500">About Me</h4>
          <p data-aos="flip-up" data-aos-duration="1000" data-aos-delay="700">
          Hi, I'm Kishan Kumar, a web developer focused on creating responsive and scalable web applications with a strong emphasis on user experience and functionality.
          </p>
        </div>
        <div className="footer-links" >
          <h4 data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="500">Quick Links</h4>
          <ul >
            <li data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="600"><a href="#about">About</a></li>
            <li data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="700"><a href="#work">Projects</a></li>
            <li data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="800"><a href="#contact">Contact</a></li>
          </ul>
        </div>
        <div className="footer-socials">
          <h4 data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="500">Connect with Me</h4>
          <div className="social-icon" data-aos="flip-down" data-aos-duration="1000" data-aos-delay="1200" >
            <a href="https://www.linkedin.com/in/kishan-kumar-586b83336?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank" rel="noopener noreferrer" >
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
        </div>
      </div>

      <div className="footer-subscription">
        <h4  data-aos="zoom-out-right" data-aos-duration="1000" data-aos-delay="800">Let's Stay Connected with <FaArrowRight />        </h4>
        <div className="subscription-form">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
             data-aos="zoom-out-left" data-aos-duration="1000" data-aos-delay="800"
          />
          <button onClick={handleSubscribe} disabled={loading}
           data-aos="flip-up" data-aos-duration="1000" data-aos-delay="1300">
            {loading ? 'Subscribing...' : 'Subscribe'}
          </button>
        </div>
      </div>

      <hr />

      <div className="footer-bottom"  data-aos="zoom-in" data-aos-duration="1000" data-aos-delay="700">
        <p>&copy; 2025 Kishan. All rights reserved.</p>
        <p>Terms of Services | Privacy Policy</p>
      </div>

      {isPopupVisible && (
        <div className="popup">
          <p>{popupMessage}</p>
        </div>
      )}
    </div>
  );
};

export default Footer;
