/**
 * Login page logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const errorDiv = document.getElementById('loginError');
  const errorText = document.getElementById('loginErrorText');

  // Check if already logged in
  if (typeof API !== 'undefined' && API.get) {
    API.get('/api/auth/me').then(data => {
      if (data && data.user) {
        window.location.href = '/dashboard';
      }
    }).catch(() => { });
  }

  // Form submission (Notice the 'async' here keeps it from crashing)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      // Use standard fetch to guarantee a clean path to your Vercel routing
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data && data.success) {
        // Redirect to dashboard
        window.location.href = '/dashboard';
      } else {
        showError(data.message || 'Invalid username or password');
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (err) {
      showError('Could not connect to server. Please try again.');
      passwordInput.value = '';
      passwordInput.focus();
    } finally {
      setLoading(false);
    }
  });

  function showError(message) {
    errorText.textContent = message;
    errorDiv.classList.add('visible');
    usernameInput.classList.add('error');
    passwordInput.classList.add('error');
  }

  function hideError() {
    errorDiv.classList.remove('visible');
    usernameInput.classList.remove('error');
    passwordInput.classList.remove('error');
  }

  function setLoading(loading) {
    if (loading) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<div class="spinner"></div> Signing in...';
    } else {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  }

  // Clear errors on input
  usernameInput.addEventListener('input', hideError);
  passwordInput.addEventListener('input', hideError);
});