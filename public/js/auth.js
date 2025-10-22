// Login form handler
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-message');

    try {
        errorDiv.style.display = 'none';

        const result = await authAPI.login(email, password);
        setToken(result.accessToken);

        // Redirect to dashboard
        window.location.href = '/portal/dashboard.html';
    } catch (error) {
        errorDiv.textContent = error.message || 'Login failed';
        errorDiv.style.display = 'block';
    }
});

// Register form handler
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const errorDiv = document.getElementById('error-message');

    try {
        errorDiv.style.display = 'none';

        const result = await authAPI.register({
            email,
            password,
            firstName,
            lastName,
        });

        setToken(result.accessToken);

        // Redirect to dashboard
        window.location.href = '/portal/dashboard.html';
    } catch (error) {
        errorDiv.textContent = error.message || 'Registration failed';
        errorDiv.style.display = 'block';
    }
});
