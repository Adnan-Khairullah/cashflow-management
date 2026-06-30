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