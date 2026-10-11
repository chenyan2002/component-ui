import './components';
import './style.css';
import './app';

function followColorScheme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('wa-dark', dark.matches);
  dark.addEventListener('change', apply);
  apply();
}

followColorScheme();
