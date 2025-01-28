import React, { useState } from 'react';
import axios from 'axios';
import './Contact.css';
import { FiMail } from "react-icons/fi";
import { LuPhoneCall } from "react-icons/lu";
import { FaMapLocationDot } from "react-icons/fa6";

const Contact = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: '',
    });

    const [loading, setLoading] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [isPopupVisible, setIsPopupVisible] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setPopupMessage('');
        
        try {
            const response = await axios.post('http://localhost:5000/api/contact', formData);
            setPopupMessage(response.data.message || 'Your message was sent successfully!');
            setFormData({ name: '', email: '', message: '' }); 
            setIsPopupVisible(true);
        } catch (error) {
            setPopupMessage(error.response?.data?.error || 'Something went wrong. Please try again.');
            setIsPopupVisible(true);
        } finally {
            setLoading(false);
            setTimeout(() => {
                setIsPopupVisible(false); 
            }, 3000);
        }
    };

    return (
        <div id='contact' className="contact">
            <div className="contact-title">
                <h1  data-aos="zoom-in" data-aos-duration="2500">Get in touch</h1>
            </div>
            <div className="contact-section">
                <div className="contact-left">
                    <h1  data-aos="zoom-out" data-aos-duration="1000" data-aos-delay="500">Let's talk</h1>
                    <p  data-aos="flip-up" data-aos-duration="1000" data-aos-delay="500">I am currently available to take on new projects. Feel free to reach out to discuss any ideas or opportunities.</p>
                    <div className="contact-details">
                        <div className="contact-detail" data-aos="flip-down" data-aos-duration="1000" data-aos-delay="500">
                            <FiMail />
                            <p>kishan.itpro@gmail.com</p>
                        </div>
                        <div className="contact-detail" data-aos="flip-up" data-aos-duration="1000" data-aos-delay="500">
                            <LuPhoneCall />
                            <p>+91 85287-92348</p>
                        </div>
                        <div className="contact-detail" data-aos="flip-down" data-aos-duration="1000" data-aos-delay="500">
                            <FaMapLocationDot />
                            <p>Chandigarh, India</p>
                        </div>
                    </div>
                </div>
                <div className="contact-right">
                    <form onSubmit={handleSubmit}>
                        <label data-aos="fade-up" data-aos-duration="1000" data-aos-delay="100">Your Name</label>
                        <input
                            type="text"
                            name="name"
                            placeholder="Enter your name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            data-aos="fade-up" data-aos-duration="1000" data-aos-delay="200"
                        />

                        <label data-aos="fade-up" data-aos-duration="1000" data-aos-delay="300">Your Email</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="Enter your email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            data-aos="fade-up" data-aos-duration="1000" data-aos-delay="400"
                        />

                        <label data-aos="fade-up" data-aos-duration="1000" data-aos-delay="500">Write your message here</label>
                        <textarea
                            name="message"
                            rows="8"
                            placeholder="Enter your message"
                            value={formData.message}
                            onChange={handleChange}
                            required
                            data-aos="fade-up" data-aos-duration="1000" data-aos-delay="600"
                        />

                        <button type="submit" className="contact-submit" disabled={loading}
                        data-aos="fade-up" data-aos-duration="1000" data-aos-delay="700">
                            {loading ? 'Submitting...' : 'Submit now'}
                        </button>
                    </form>
                </div>
            </div>

            
            {isPopupVisible && (
                <div className="popup">
                    <p>{popupMessage}</p>
                </div>
            )}
        </div>
    );
};

export default Contact;
