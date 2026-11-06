const titleScreen = document.getElementById('title-screen');
const startButton = document.getElementById('start-game');
const startStatus = document.getElementById('start-status');

if (location.protocol === 'file:') {
  titleScreen.hidden = true;
  document.getElementById('file-warning').hidden = false;
} else {
  startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    startStatus.textContent = 'Loading the board…';

    try {
      await import('./main.js');
      titleScreen.hidden = true;
      document.querySelector('.ft-btn:not(:disabled)')?.focus();
    } catch (error) {
      console.error('Fingertip Tactics could not start.', error);
      startStatus.textContent = 'The board failed to load. Check your connection, then reload the page.';
    }
  }, { once: true });
}
