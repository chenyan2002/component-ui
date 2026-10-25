// The guest's frames of a trap, which the console shows, come after those of its runtime, e.g.
// Rust's panic handling; V8 keeps 10 by default.
(Error as { stackTraceLimit?: number }).stackTraceLimit = 200;

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
