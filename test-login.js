import fetch from 'node-fetch';

async function testLogin() {
  try {
    // Test login endpoint
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@internshippro.com',
        password: 'admin123'
      })
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Login successful!');
    } else {
      console.log('❌ Login failed:', data.error || data.message);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testLogin();
