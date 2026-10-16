import { Sun, Moon, Globe } from 'lucide-react';
import { useTheme } from '../hooks/useTheme'; // عدّل المسار

// جوه الكومبوننت
const { theme, toggle } = useTheme();

// جنب زرار اللغة
<div className="header-actions">
  <button
    type="button"
    className="theme-toggle-btn"
    onClick={toggle}
    aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
  >
    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
  </button>

  {/* زرار "عربي" الحالي زي ما هو */}
</div>
