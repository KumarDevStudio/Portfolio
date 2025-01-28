import React, { useEffect, useState } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import './MyWork.css';
import Details from '../../assets/myworkdata';
import { IoMdArrowRoundForward } from "react-icons/io";

const MyWork = () => {
    const [visibleServices, setVisibleServices] = useState(4);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        AOS.init({ duration: 1000 });
    }, []);

    const toggleShowMore = () => {
        if (showAll) {
            setVisibleServices(4); 
        } else {
            setVisibleServices(Details.length);
        }
        setShowAll(!showAll);
    };

    return (
        <div id="work" className="mywork">
            <div className="work-title">
                <h1 data-aos="zoom-in" data-aos-duration="1500">My Latest Work</h1>
                {/* <img
                    src="/path/to/your/image.jpg"
                    alt="Services Illustration"
                    data-aos="zoom-in"
                    data-aos-duration="1500"
                /> */}
            </div>
            <div className="work-container">
                {Details.slice(0, visibleServices).map((work, index) => {
                    return (
                        <div
                            key={index}
                            className="work-card"
                            data-aos="fade-up"
                            data-aos-delay={index * 100}
                        >
                            <img
                                src={work.image}
                                alt={work.title}
                                className="work-image"
                                data-aos="zoom-in"
                                data-aos-delay={index * 150}
                            />
                            <div className="work-info">
                                <h3>{work.title}</h3>
                                <p>{work.description}</p>
                                <div className="work-links">

                                    <button
                                        onClick={() => window.open(work.liveDemo, "_blank", "noopener,noreferrer")}
                                        className="work-btn"
                                        data-aos="fade-right"
                                        aria-label="View Live Demo"
                                    >
                                        Live Demo
                                    </button>

                                    <button
                                        onClick={() => window.open(work.sourceCode, "_blank", "noopener,noreferrer")}
                                        className="work-btn"
                                        data-aos="fade-left"
                                        aria-label="View Source Code"
                                    >
                                        Source Code
                                    </button>
                                </div>
                            </div>

                        </div>
                    );
                })}
            </div>
            <div className="work-showmore" onClick={toggleShowMore} data-aos="fade-up">
                <p>{showAll ? 'Show Less' : 'Show More'}</p>
                <IoMdArrowRoundForward />
            </div>
        </div>
    );
};

export default MyWork;
