import { NavLink } from 'react-router-dom';

const classes = ({ isActive }: { isActive: boolean }) =>
  `bottom-nav__link${isActive ? ' bottom-nav__link--active' : ''}`;

export const BottomNav = () => (
  <nav className="bottom-nav" aria-label="Primary">
    <NavLink to="/" className={classes} end>
      Home
    </NavLink>
  </nav>
);
