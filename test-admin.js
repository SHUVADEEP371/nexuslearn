const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

async function testAdminLogin() {
  try {
    console.log('Testing admin login...');
    
    // Test admin login
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: process.env.ADMIN_ID || 'admin@example.com',
      password: process.env.ADMIN_PASS || 'adminpass'
    });
    
    console.log('✅ Admin login successful');
    console.log('Token:', loginResponse.data.token);
    console.log('User:', loginResponse.data.user);
    
    // Test admin access to users endpoint
    const usersResponse = await axios.get(`${API_BASE_URL}/users/all`, {
      headers: {
        'Authorization': `Bearer ${loginResponse.data.token}`
      }
    });
    
    console.log('✅ Admin access to /users/all successful');
    console.log('Users count:', usersResponse.data.length);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testAdminLogin(); 