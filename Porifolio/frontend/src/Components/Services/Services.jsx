import React, { useState } from 'react';
import './Services.css';
import Data from '../../assets/services_d';
import { IoMdArrowRoundForward } from "react-icons/io";

const Services = () => {
    const [visibleServices, setVisibleServices] = useState(4);
    const [showAll, setShowAll] = useState(false);

    const toggleShowMore = () => {
        if (showAll) {
            setVisibleServices(4); 
        } else {
            setVisibleServices(Data.length);
        }
        setShowAll(!showAll);
    };

    return (
        <div id="services" className="services">
            <div className="services-title">
                <h1 data-aos="zoom-in" data-aos-duration="2500">My Services</h1>
                {/* <img
                    src="src/assets/1.png"
                    alt="Services Illustration"
                    data-aos="zoom-in"
                    data-aos-duration="2500"
                /> */}
            </div>

            <div className="services-container">
                {Data.slice(0, visibleServices).map((service, index) => (
                    <ServiceCard key={index} service={service} delay={100 * (index + 1)} />
                ))}
            </div>

            <div className="service-showmore" onClick={toggleShowMore} data-aos="fade-up" data-aos-duration="2000">
                <p>{showAll ? 'Show Less' : 'Show More'}</p>
                <IoMdArrowRoundForward />
            </div>
        </div>
    );
};

const ServiceCard = ({ service, delay }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div
            className="services-format"
            data-aos="fade-up"
            data-aos-duration="1000"
            data-aos-delay={delay}
        >
            <h3>{service.No}</h3>
            <h2>{service.Name}</h2>
            <p className={`service-desc ${isExpanded ? 'expanded' : ''}`}>
                {service.Desc}
            </p>
            <div
                className="services-readmore"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <p>{isExpanded ? 'Show Less' : 'Read More'}</p>
                <IoMdArrowRoundForward />
            </div>
        </div>
    );
};

export default Services;
