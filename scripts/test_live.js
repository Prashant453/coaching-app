const axios = require('axios');
const API = 'https://coaching-app-srcf.onrender.com/api';

async function testApi() {
    try {
        console.log('Logging in...');
        const loginRes = await axios.post(`${API}/auth/login`, {
            email: 'admin@coaching.com',
            password: 'admin123'
        });
        const token = loginRes.data.token;
        console.log('Got token:', token.substring(0, 15) + '...');

        console.log('Testing Get Users...');
        const userRes = await axios.get(`${API}/courses/admin/users`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const users = userRes.data.users;
        console.log('Found users:', users.length);
        
        console.log('Testing Get Courses...');
        const courseRes = await axios.get(`${API}/courses`);
        const courses = courseRes.data.courses;
        console.log('Found courses:', courses.length);
        
        if (users.length > 0 && courses.length > 0) {
            console.log('Testing Grant Access with NEW payload...');
            try {
                const grantRes = await axios.post(`${API}/admin/enrollments/grant`, {
                    user_id: users.find(u => u.role === 'student').id,
                    course_id: courses[0].id
                }, { headers: { Authorization: `Bearer ${token}` } });
                console.log('Grant Success:', grantRes.data);
            } catch (err) {
                console.error('Grant Failed:', err.response?.data || err.message);
            }
        }
    } catch(err) {
        console.error('Test Failed:', err.response?.data || err.message);
    }
}
testApi();
