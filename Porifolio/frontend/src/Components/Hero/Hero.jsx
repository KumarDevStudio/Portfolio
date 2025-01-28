import React from 'react'
import './Hero.css'
import Profile from '../../assets/kk.png'
import AnchorLink from 'react-anchor-link-smooth-scroll'
import { Link } from 'react-router-dom';  // Using Link for navigation in React Router

const Hero = () => {
    return (
        <div id='home' className='hero'>
            <img src={Profile} alt="" />
            <h1><span>I'm Kishan Kumar,</span><br /> MERN Stack developer</h1>
            <p>Full Stack Developer with expertise in
                crafting scalable backend architectures
                and intuitive frontend designs. Proficient
                in React, Node.js, MongoDB, and API
                integrations. Passionate about creating
                efficient, user-focused web applications
                and optimizing performance for
                seamless operations</p>
                <div className="hero-action">
                    <div className="hero-connect"><AnchorLink className='anchor-link' offset={50} href='#contact'>Connect With Me</AnchorLink></div>
                    {/* Use Link to navigate to the Resume Page */}
                    <div className="hero-resume">
                        <Link to="/resume">My Resume</Link>
                    </div>
                </div>
        </div>
    )
}
export default Hero