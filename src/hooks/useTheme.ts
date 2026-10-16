import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme'; // عدّل المسار

// جوه الكومبوننت
const { theme, toggle } = useTheme();

<button
  type="button"
  className="lang-toggle theme-toggle"
  onClick={toggle}
  aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
  title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
>
  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
</button>
