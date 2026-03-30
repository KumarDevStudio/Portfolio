
export const animations = {
  fadeInUp: {
    initial: { opacity: 0, transform: 'translateY(60px)' },
    animate: { opacity: 1, transform: 'translateY(0px)' },
    transition: 'opacity 0.8s ease-out, transform 0.8s ease-out'
  },
  fadeInLeft: {
    initial: { opacity: 0, transform: 'translateX(-60px)' },
    animate: { opacity: 1, transform: 'translateX(0px)' },
    transition: 'opacity 0.8s ease-out, transform 0.8s ease-out'
  },
  fadeInRight: {
    initial: { opacity: 0, transform: 'translateX(60px)' },
    animate: { opacity: 1, transform: 'translateX(0px)' },
    transition: 'opacity 0.8s ease-out, transform 0.8s ease-out'
  },
  scaleIn: {
    initial: { opacity: 0, transform: 'scale(0.8)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
  },
  staggerChildren: (delay = 0.1) => ({
    initial: { opacity: 0, transform: 'translateY(30px)' },
    animate: { opacity: 1, transform: 'translateY(0px)' },
    transition: `opacity 0.6s ease-out ${delay}s, transform 0.6s ease-out ${delay}s`
  })
};