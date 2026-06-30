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
  API.get('/api/auth/me').then(data => {
    if (data && data.user) {
      window.location.href = '/dashboard';
    }
  }).catch(() => {});

  // Form submission
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
      const data = await API.post('/api/auth/login', { username, password });
      if (data && data.success) {
        // Redirect to dashboard
        window.location.href = '/dashboard';
      }
    } catch (err) {
      showError(err.message || 'Invalid username or password');
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
