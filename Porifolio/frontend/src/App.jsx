import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './Components/Navbar/Navbar';
import Hero from './Components/new/New';
import About from './Components/About/About';
import Services from './Components/Services/Services';
import MyWork from './Components/MyWork/MyWork';
import Contact from './Components/Contact/Contact';
import Footer from './Components/Footer/Footer';
import ResumePage from './Components/ResumePage/ResumePage'; 

const App = () => {
  return (
    <Router>
      <div>
        <Navbar />
        
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/resume" element={<ResumePage />} />
        </Routes>

        <About />
        <Services />
        <MyWork />
        <Contact />
        <Footer />
      </div>
    </Router>
  );
}

export default App;
