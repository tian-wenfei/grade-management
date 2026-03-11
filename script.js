const API_BASE = window.location.origin + '/api';

function toggleAdminPanel() {
    const adminPanel = document.getElementById('admin-panel');
    let overlay = document.getElementById('admin-overlay');
    
    if (adminPanel.style.display === 'none' || adminPanel.style.display === '') {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'admin-overlay';
            overlay.className = 'admin-overlay';
            overlay.onclick = toggleAdminPanel;
            document.body.appendChild(overlay);
        }
        adminPanel.style.display = 'flex';
        checkUserLoginStatus();
    } else {
        adminPanel.style.display = 'none';
        if (overlay) {
            overlay.remove();
        }
    }
}

function switchAuthTab(tab) {
    if (tab === 'login') {
        document.getElementById('login-form').style.display = 'flex';
        document.getElementById('register-form').style.display = 'none';
        document.querySelector('.auth-tab:nth-child(1)').classList.add('active');
        document.querySelector('.auth-tab:nth-child(2)').classList.remove('active');
    } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'flex';
        document.querySelector('.auth-tab:nth-child(1)').classList.remove('active');
        document.querySelector('.auth-tab:nth-child(2)').classList.add('active');
    }
    document.getElementById('authStatus').innerHTML = '';
}

async function checkUserLoginStatus() {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole');
    
    if (token && username) {
        try {
            const response = await fetch(`${API_BASE}/user`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                document.querySelector('.login-card').style.display = 'none';
                document.getElementById('upload-section').style.display = 'flex';
                document.getElementById('currentUser').textContent = username;
                
                if (userRole === 'admin') {
                    document.getElementById('manageUsersBtn').style.display = 'inline-block';
                    document.getElementById('manageExamsBtn').style.display = 'inline-block';
                }
                return;
            }
        } catch (error) {
            console.error('Token验证失败:', error);
        }
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');
    document.querySelector('.login-card').style.display = 'flex';
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('manageUsersBtn').style.display = 'none';
    document.getElementById('manageExamsBtn').style.display = 'none';
}

function showMessage(element, message, isSuccess = true) {
    const className = isSuccess ? 'success' : 'error';
    element.innerHTML = `<div class="${className}">${message}</div>`;
    
    setTimeout(() => {
        element.innerHTML = '';
    }, 2000);
}

async function createUser() {
    const newUsername = document.getElementById('newUsername').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const newUserRole = document.getElementById('newUserRole').value;
    const token = localStorage.getItem('token');
    
    if (!newUsername) {
        alert('请输入用户名');
        return;
    }
    
    if (!newPassword) {
        alert('请输入密码');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                username: newUsername,
                password: newPassword,
                role: newUserRole
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('用户创建成功');
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            loadUsers();
        } else {
            alert(data.error || '创建失败');
        }
    } catch (error) {
        alert('网络错误');
    }
}

async function userLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const authStatus = document.getElementById('authStatus');
    
    if (!username || !password) {
        showMessage(authStatus, '请输入用户名和密码', false);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.username);
            localStorage.setItem('userRole', data.user.role);
            showMessage(authStatus, '登录成功！', true);
            
            if (data.user.role === 'admin') {
                document.getElementById('manageUsersBtn').style.display = 'inline-block';
                document.getElementById('manageExamsBtn').style.display = 'inline-block';
            }
            
            setTimeout(() => {
                checkUserLoginStatus();
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
            }, 1000);
        } else {
            showMessage(authStatus, data.error || '用户名或密码错误', false);
        }
    } catch (error) {
        showMessage(authStatus, '网络错误，请确保服务器已启动', false);
    }
}

function userLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');
    document.getElementById('manageUsersBtn').style.display = 'none';
    document.getElementById('manageExamsBtn').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'none';
    const overlay = document.getElementById('admin-overlay');
    if (overlay) overlay.remove();
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-content').forEach(content => content.classList.remove('active'));
    
    if (tab === 'upload') {
        document.querySelector('.admin-tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('admin-upload').classList.add('active');
    } else if (tab === 'users') {
        document.querySelector('.admin-tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('admin-users').classList.add('active');
        loadUsers();
    } else if (tab === 'exams') {
        document.querySelector('.admin-tab-btn:nth-child(3)').classList.add('active');
        document.getElementById('admin-exams').classList.add('active');
        loadExams();
    } else if (tab === 'settings') {
        const settingsBtn = document.querySelector('.admin-tab-btn:last-child');
        if (settingsBtn) settingsBtn.classList.add('active');
        document.getElementById('admin-settings').classList.add('active');
    }
}

async function loadUsers() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '';
            
            users.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.role === 'admin' ? '管理员' : '用户'}</td>
                    <td>${new Date(user.createdAt).toLocaleString('zh-CN')}</td>
                    <td>
                        <button class="action-btn delete-btn" onclick="deleteUser(${user.id})">删除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('加载用户失败:', error);
    }
}

async function deleteUser(userId) {
    if (!confirm('确定要删除此用户吗？')) return;
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (response.ok) {
            alert('用户删除成功');
            loadUsers();
        } else {
            alert(data.error || '删除失败');
        }
    } catch (error) {
        alert('网络错误');
    }
}

async function loadExams() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch(`${API_BASE}/exams`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const exams = await response.json();
            const tbody = document.getElementById('examsTableBody');
            tbody.innerHTML = '';
            
            exams.forEach(exam => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${exam.id}</td>
                    <td>${exam.examName}</td>
                    <td>${exam.uploader}</td>
                    <td>${new Date(exam.createdAt).toLocaleString('zh-CN')}</td>
                    <td>
                        <button class="action-btn delete-btn" onclick="deleteExam(${exam.id})">删除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('加载考试失败:', error);
    }
}

async function deleteExam(examId) {
    if (!confirm('确定要删除此考试及其所有成绩数据吗？此操作不可恢复！')) return;
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_BASE}/admin/exams/${examId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (response.ok) {
            alert('考试删除成功');
            loadExams();
        } else {
            alert(data.error || '删除失败');
        }
    } catch (error) {
        alert('网络错误');
    }
}

async function changeUsername() {
    const newUsername = document.getElementById('newUsernameInput').value.trim();
    const password = document.getElementById('usernamePassword').value.trim();
    const token = localStorage.getItem('token');
    
    if (!newUsername) {
        alert('请输入新用户名');
        return;
    }
    
    if (!password) {
        alert('请输入密码确认');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/user/username`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ newUsername, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.username);
            document.getElementById('currentUser').textContent = data.user.username;
            document.getElementById('newUsernameInput').value = '';
            document.getElementById('usernamePassword').value = '';
            alert('用户名修改成功');
        } else {
            alert(data.error || '修改失败');
        }
    } catch (error) {
        alert('网络错误');
    }
}

async function changePassword() {
    const oldPassword = document.getElementById('changeOldPassword').value.trim();
    const newPassword = document.getElementById('changeNewPassword').value.trim();
    const confirmNewPassword = document.getElementById('changeConfirmPassword').value.trim();
    const token = localStorage.getItem('token');
    
    if (!oldPassword || !newPassword || !confirmNewPassword) {
        alert('请填写所有密码字段');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        alert('两次输入的新密码不一致');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/user/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('changeOldPassword').value = '';
            document.getElementById('changeNewPassword').value = '';
            document.getElementById('changeConfirmPassword').value = '';
            alert('密码修改成功');
        } else {
            alert(data.error || '修改失败');
        }
    } catch (error) {
        alert('网络错误');
    }
}

function generateUniqueFilename(filename, username) {
    const timestamp = new Date().getTime();
    const extension = filename.substring(filename.lastIndexOf('.'));
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    return `${nameWithoutExt}_${username}_${timestamp}${extension}`;
}

async function uploadExcel() {
    const currentUser = localStorage.getItem('username');
    const token = localStorage.getItem('token');
    
    if (!currentUser || !token) {
        alert('请先登录');
        return;
    }
    
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    const uploadStatus = document.getElementById('uploadStatus');
    
    if (!file) {
        showMessage(uploadStatus, '请选择Excel文件', false);
        return;
    }
    
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        showMessage(uploadStatus, '请选择Excel文件(.xlsx或.xls)', false);
        return;
    }
    
    const formData = new FormData();
    formData.append('excelFile', file);
    
    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            let message = '成绩上传成功！共上传 ' + result.recordCount + ' 条记录';
            if (result.invalidCount > 0) {
                message += '，跳过 ' + result.invalidCount + ' 条无效记录';
            }
            
            showMessage(uploadStatus, message, true);
            
            setTimeout(() => {
                const overlay = document.getElementById('admin-overlay');
                if (overlay) overlay.remove();
                document.getElementById('admin-panel').style.display = 'none';
                
                const mainContainer = document.querySelector('.container');
                const successAlert = document.createElement('div');
                successAlert.className = 'success global-alert';
                successAlert.textContent = message;
                mainContainer.insertBefore(successAlert, mainContainer.firstChild);
                
                setTimeout(() => {
                    successAlert.remove();
                }, 3000);
            }, 2000);
            
            fileInput.value = '';
        } else {
            showMessage(uploadStatus, result.error || '上传失败', false);
        }
    } catch (error) {
        showMessage(uploadStatus, '上传失败：' + error.message, false);
    }
}

async function queryGrade() {
    const studentName = document.getElementById('studentName').value.trim();
    const studentId = document.getElementById('studentId').value.trim();
    const gradeResult = document.getElementById('gradeResult');
    
    if (!studentName) {
        showMessage(gradeResult, '请输入姓名', false);
        return;
    }
    
    if (!studentId) {
        showMessage(gradeResult, '请输入学号', false);
        return;
    }
    
    try {
        const response = await fetch(
            `${API_BASE}/grades?studentName=${encodeURIComponent(studentName)}&studentId=${encodeURIComponent(studentId)}`
        );
        
        const data = await response.json();
        
        if (response.ok) {
            if (!data.results || data.results.length === 0) {
                showMessage(gradeResult, '未找到匹配的姓名和学号组合', false);
                return;
            }
            
            const results = data.results;
            
            let tableHtml = '';
            
            results.forEach((item, index) => {
                if (index > 0) {
                    tableHtml += '<hr style="margin: 20px 0;">';
                }
                
                tableHtml += '<h3 class="exam-name">' + item.examName + '</h3>';
                tableHtml += '<table>';
                
                for (const [key, value] of Object.entries(item.grade)) {
                    tableHtml += `<tr><td>${key}</td><td>${value}</td></tr>`;
                }
                
                tableHtml += '</table>';
            });
            
            gradeResult.innerHTML = '<div class="success">查询成功！找到 ' + results.length + ' 条记录</div>' + tableHtml;
            
            setTimeout(() => {
                const successMessage = gradeResult.querySelector('.success');
                if (successMessage) {
                    successMessage.remove();
                }
            }, 2000);
        } else {
            showMessage(gradeResult, data.error || '查询失败', false);
        }
    } catch (error) {
        showMessage(gradeResult, '网络错误，请确保服务器已启动', false);
    }
}

window.onload = function() {
    checkUserLoginStatus();
};
