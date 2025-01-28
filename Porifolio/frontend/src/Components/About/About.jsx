import React from 'react';
import './About.css';
import Me from '../../assets/kk1.jpg';
import { FaAward } from 'react-icons/fa';
import { LuUsers } from 'react-icons/lu';
import { MdOutlineFolderCopy } from 'react-icons/md';
import { BiCodeAlt } from 'react-icons/bi';
import AnchorLink from 'react-anchor-link-smooth-scroll';

const About = () => {

  return (
    <div id='about' className='about' >

      <h2 data-aos="zoom-in" data-aos-duration="2500">About Me</h2>
      <h5 data-aos="zoom-in" data-aos-duration="2500">Discover My Journey</h5>

      <div className="about-container">

        {/* <div className="about-me">
          <div className="about-image">
            <img src={Me} alt="About Me" />
          </div>
        </div> */}

        <div className="about-content">
          <div className="about-cards">
            <article className='about-card' data-aos="fade-up" data-aos-duration="1000" data-aos-delay="100">
              <FaAward className='about-icon' />
              <h5>Experience</h5>
              <small>6 Months Internship</small>
            </article>

            <article className='about-card' data-aos="fade-up" data-aos-duration="1000" data-aos-delay="200">
              <LuUsers className='about-icon' />
              <h5>Clients</h5>
              <small>----</small>
            </article>

            <article className='about-card' data-aos="fade-up" data-aos-duration="1000" data-aos-delay="300">
              <MdOutlineFolderCopy className='about-icon' />
              <h5>Projects</h5>
              <small>2+ Completed Projects</small>
            </article>

            <article className='about-card' data-aos="fade-up" data-aos-duration="1000" data-aos-delay="500">
              <BiCodeAlt className='about-icon' />
              <h5>Skills</h5>
              <small>React, Node.js, MongoDB & More</small>
            </article>


          </div>

          <p data-aos="zoom-out" data-aos-duration="1000" data-aos-delay="500">
            I am a passionate and dedicated Full Stack Developer with a focus on crafting dynamic web applications featuring intuitive user interfaces and reliable backend architectures. Proficient in the MERN stack, I enjoy learning and implementing new technologies to solve problems and optimize application performance.
          </p>

          <p data-aos="zoom-out" data-aos-duration="1000" data-aos-delay="600">
            As a fresher, I have gained practical experience through academic projects and internships, where I developed my skills in collaboration, problem-solving, and time management. I am committed to continuous learning and eager to contribute to impactful projects that make a difference.
          </p>
          <p data-aos="zoom-out" data-aos-duration="1000" data-aos-delay="700">
            I am excited to bring my skills, dedication, and fresh perspective to new opportunities in the field of web development.
          </p>
          <button className="about-btn" data-aos="zoom-in-right" data-aos-duration="2500">
  <AnchorLink className='anchor-btn' offset={50} href='#contact'>Let’s Talk</AnchorLink>

</button>

        </div>

        
        <div className="about-me" data-aos="zoom-in-right" data-aos-duration="2500">
          <div className="about-image" >
            <img src={Me} alt="About Me" />
          </div>
        </div>
      </div>

    </div>
  );
};

export default About;
