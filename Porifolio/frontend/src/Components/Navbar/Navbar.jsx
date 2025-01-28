import React, { useRef, useState } from 'react'
import './Navbar.css'
import logo from '../../assets/logo.png'
import AnchorLink from 'react-anchor-link-smooth-scroll'
import { CiMenuFries } from "react-icons/ci";
import { IoCloseOutline } from "react-icons/io5";



const Navbar = () => {

  const [menu, setMenu] = useState('home');
  const menuRef = useRef();

  const openMenu =()=>{
    menuRef.current.style.right='0';
  }
  const closeMenu =()=>{
    menuRef.current.style.right='-350px';
  }



  return (
    <div className='navbar'>
      <img className='logo' src={logo} alt="" />
      <CiMenuFries className='nav-mob-open' onClick={openMenu} />
      <ul ref={menuRef} className="nav-menu">
      <IoCloseOutline className='nav-mob-close' onClick={closeMenu} />
      <li><AnchorLink className='anchor-link'  href='#home'  data-aos="fade-up" data-aos-duration="1000" data-aos-delay="100"><p onClick={()=>setMenu('home')}>Home</p></AnchorLink>{menu === 'home' ? <img src="" alt="" /> : <></>}</li>
        <li><AnchorLink className='anchor-link' offset={50} href='#about'  data-aos="fade-up" data-aos-duration="1000" data-aos-delay="200"><p onClick={()=>setMenu('about')}>About Me</p></AnchorLink>{menu === 'about' ? <img src="" alt="" /> : <></>}</li>
        <li><AnchorLink className='anchor-link' offset={50} href='#services'  data-aos="fade-up" data-aos-duration="1000" data-aos-delay="300"><p onClick={()=>setMenu('services')}>Services</p></AnchorLink>{menu === 'services' ? <img src="" alt="" /> : <></>}</li>
        <li><AnchorLink className='anchor-link' offset={50} href='#work'  data-aos="fade-up" data-aos-duration="1000" data-aos-delay="400"><p onClick={()=>setMenu('work')}>Portfolio</p></AnchorLink>{menu === 'work' ? <img src="" alt="" /> : <></>}</li>
        <li><AnchorLink className='anchor-link' offset={50} href='#contact'  data-aos="fade-up" data-aos-duration="1000" data-aos-delay="500"><p onClick={()=>setMenu('contact')}>Contact</p></AnchorLink>{menu === 'contact' ? <img src="" alt="" /> : <></>}</li>

      </ul>
      <div className="nav-connect"  data-aos="fade-up" data-aos-duration="1000" data-aos-delay="600"><AnchorLink className='anchor-link' offset={50} href='#contact'>Connect With Me</AnchorLink></div>
    </div>
  )
}

export default Navbar