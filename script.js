const API_BASE = window.location.origin + '/api';

function showRateLimitMessage(error, retryAfter) {
    const existing = document.getElementById('rate-limit-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'rate-limit-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 40px;
            border-radius: 16px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
            <div style="font-size: 60px; margin-bottom: 20px;">⏳</div>
            <h3 style="color: #f44336; margin-bottom: 15px;">访问繁忙</h3>
            <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">${error}</p>
            <p style="color: #999; font-size: 14px;">请等待 <span id="retry-countdown">${retryAfter || 10}</span> 秒后重试</p>
            <button onclick="this.parentElement.parentElement.remove()" style="
                margin-top: 20px;
                padding: 12px 30px;
                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
            ">关闭</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const countdown = document.getElementById('retry-countdown');
    let seconds = parseInt(retryAfter) || 10;
    const timer = setInterval(() => {
        seconds--;
        if (countdown) countdown.textContent = seconds;
        if (seconds <= 0) {
            clearInterval(timer);
            modal.remove();
        }
    }, 1000);
}

async function fetchWithRateLimit(url, options = {}) {
    try {
        const response = await fetch(url, options);
        
        if (response.status === 429) {
            const data = await response.json();
            showRateLimitMessage(data.error, data.retryAfter);
            throw new Error(data.error);
        }
        
        if (response.status === 503) {
            const data = await response.json();
            showRateLimitMessage(data.error, data.retryAfter);
            throw new Error(data.error);
        }
        
        return response;
    } catch (error) {
        throw error;
    }
}

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
            const response = await fetchWithRateLimit(`${API_BASE}/user`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                document.querySelector('.login-card').style.display = 'none';
                document.getElementById('upload-section').style.display = 'flex';
                document.getElementById('currentUser').textContent = username;
                
                if (userRole === 'admin' || userRole === 'superadmin') {
                    document.getElementById('manageUsersBtn').style.display = 'inline-block';
                    document.getElementById('manageExamsBtn').style.display = 'inline-block';
                }
                
                const adminOption = document.getElementById('adminOption');
                if (userRole === 'superadmin' && adminOption) {
                    adminOption.style.display = 'block';
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
        const response = await fetchWithRateLimit(`${API_BASE}/admin/users`, {
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
        const response = await fetchWithRateLimit(`${API_BASE}/login`, {
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

let allUsers = [];
let allExams = [];
let currentUserPage = 1;
let currentExamPage = 1;
const pageSize = 10;

async function loadUsers() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetchWithRateLimit(`${API_BASE}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            allUsers = await response.json();
            currentUserPage = 1;
            renderUsers();
        }
    } catch (error) {
        console.error('加载用户失败:', error);
    }
}

function searchUsers() {
    currentUserPage = 1;
    renderUsers();
}

function renderUsers() {
    const searchValue = document.getElementById('userSearchInput')?.value?.toLowerCase() || '';
    const filteredUsers = allUsers.filter(user => 
        user.username.toLowerCase().includes(searchValue)
    );
    
    const totalPages = Math.ceil(filteredUsers.length / pageSize);
    const startIndex = (currentUserPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageUsers = filteredUsers.slice(startIndex, endIndex);
    
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    if (pageUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>';
    } else {
        pageUsers.forEach((user, index) => {
            const roleMap = {
                'superadmin': '超级管理员',
                'admin': '管理员',
                'user': '普通用户'
            };
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${startIndex + index + 1}</td>
                <td>${user.username}</td>
                <td>${roleMap[user.role] || user.role}</td>
                <td>${new Date(user.createdAt).toLocaleString('zh-CN')}</td>
                <td>
                    <button class="action-btn delete-btn" onclick="deleteUser(${user.id})">删除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    renderPagination('usersPagination', totalPages, currentUserPage, (page) => {
        currentUserPage = page;
        renderUsers();
    });
}

function renderPagination(containerId, totalPages, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一页';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => onPageChange(currentPage - 1);
    container.appendChild(prevBtn);
    
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.onclick = () => onPageChange(1);
        container.appendChild(firstBtn);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '8px';
            container.appendChild(dots);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === currentPage ? 'active' : '';
        btn.onclick = () => onPageChange(i);
        container.appendChild(btn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '8px';
            container.appendChild(dots);
        }
        
        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => onPageChange(totalPages);
        container.appendChild(lastBtn);
    }
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一页';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => onPageChange(currentPage + 1);
    container.appendChild(nextBtn);
}

async function deleteUser(userId) {
    if (!confirm('确定要删除此用户吗？')) return;
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetchWithRateLimit(`${API_BASE}/admin/users/${userId}`, {
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
        const response = await fetchWithRateLimit(`${API_BASE}/exams`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            allExams = await response.json();
            currentExamPage = 1;
            renderExams();
        }
    } catch (error) {
        console.error('加载考试失败:', error);
    }
}

function searchExams() {
    currentExamPage = 1;
    renderExams();
}

function renderExams() {
    const searchValue = document.getElementById('examSearchInput')?.value?.toLowerCase() || '';
    const filteredExams = allExams.filter(exam => 
        exam.examName.toLowerCase().includes(searchValue) ||
        exam.uploader.toLowerCase().includes(searchValue)
    );
    
    const sortedExams = [...filteredExams].sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
    );
    
    const totalPages = Math.ceil(filteredExams.length / pageSize);
    const startIndex = (currentExamPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageExams = filteredExams.slice(startIndex, endIndex);
    
    const tbody = document.getElementById('examsTableBody');
    tbody.innerHTML = '';
    
    if (pageExams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:30px;">暂无数据</td></tr>';
    } else {
        pageExams.forEach((exam, index) => {
            const sortedIndex = sortedExams.findIndex(e => e.id === exam.id) + 1;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sortedIndex}</td>
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
    
    renderPagination('examsPagination', totalPages, currentExamPage, (page) => {
        currentExamPage = page;
        renderExams();
    });
}

async function deleteExam(examId) {
    if (!confirm('确定要删除此考试及其所有成绩数据吗？此操作不可恢复！')) return;
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetchWithRateLimit(`${API_BASE}/admin/exams/${examId}`, {
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
        const response = await fetchWithRateLimit(`${API_BASE}/user/username`, {
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
        const response = await fetchWithRateLimit(`${API_BASE}/user/password`, {
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
    if (typeof XLSX === 'undefined') {
        alert('Excel解析库加载失败，请刷新页面重试');
        return;
    }
    
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
        uploadStatus.innerHTML = '<div class="error">请选择Excel文件</div>';
        return;
    }
    
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        uploadStatus.innerHTML = '<div class="error">请选择Excel文件(.xlsx或.xls)</div>';
        return;
    }
    
    const originalFilename = file.name;
    const examName = originalFilename.substring(0, originalFilename.lastIndexOf('.'));
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            let nameRowIndex = -1;
            
            for (let r = range.s.r; r <= range.e.r; r++) {
                for (let c = range.s.c; c <= range.e.c; c++) {
                    const cellAddress = XLSX.utils.encode_cell({r, c});
                    const cell = worksheet[cellAddress];
                    if (cell && (cell.v === '姓名' || cell.v === 'name')) {
                        nameRowIndex = r;
                        break;
                    }
                }
                if (nameRowIndex !== -1) break;
            }
            
            if (nameRowIndex === -1) {
                showMessage(uploadStatus, '未找到包含"姓名"标题的行', false);
                return;
            }
            
            const headers = [];
            for (let c = range.s.c; c <= range.e.c; c++) {
                const cellAddress = XLSX.utils.encode_cell({r: nameRowIndex, c});
                const cell = worksheet[cellAddress];
                headers.push(cell ? cell.v : '');
            }
            
            const processedHeaders = [];
            
            for (let c = range.s.c; c <= range.e.c; c++) {
                const cellAddress = XLSX.utils.encode_cell({r: nameRowIndex, c});
                const cell = worksheet[cellAddress];
                let header = cell ? cell.v : '';
                
                if (header === '排名') {
                    let subjectName = '';
                    for (let i = c - 1; i >= range.s.c; i--) {
                        const prevHeader = headers[i - range.s.c];
                        if (prevHeader && prevHeader !== '排名') {
                            subjectName = prevHeader;
                            break;
                        }
                    }
                    if (subjectName) {
                        header = subjectName + '排名';
                    } else {
                        header = '排名';
                    }
                }
                
                processedHeaders.push(header);
            }
            
            const jsonData = [];
            for (let r = nameRowIndex + 1; r <= range.e.r; r++) {
                const rowData = {};
                let hasData = false;
                
                for (let c = range.s.c; c <= range.e.c; c++) {
                    const cellAddress = XLSX.utils.encode_cell({r, c});
                    const cell = worksheet[cellAddress];
                    const header = processedHeaders[c - range.s.c];
                    
                    if (header) {
                        rowData[header] = cell ? cell.v : '';
                        if (cell && cell.v) hasData = true;
                    }
                }
                
                if (hasData) {
                    jsonData.push(rowData);
                }
            }
            
            if (jsonData.length === 0) {
                showMessage(uploadStatus, '未找到有效数据行', false);
                return;
            }
            
            let validData = [];
            let invalidCount = 0;
            
            jsonData.forEach((row, index) => {
                if (!row.姓名 && !row.name) {
                    invalidCount++;
                    return;
                }
                
                if ((row.学号 || row.id || row.studentId) === undefined) {
                    invalidCount++;
                    return;
                }
                
                validData.push(row);
            });
            
            if (validData.length === 0) {
                showMessage(uploadStatus, '所有数据行均无效', false);
                return;
            }
            
            const response = await fetchWithRateLimit(`${API_BASE}/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    examName,
                    grades: validData,
                    originalFilename
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                let message = '成绩上传成功！共上传 ' + result.recordCount + ' 条记录';
                if (result.invalidCount > 0) {
                    message += '，跳过 ' + result.invalidCount + ' 条无效记录';
                }
                
                showMessage(uploadStatus, message, true);
                
                setTimeout(() => {
                    document.getElementById('admin-panel').style.display = 'none';
                    
                    const overlay = document.getElementById('admin-overlay');
                    if (overlay) overlay.remove();
                    
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
            showMessage(uploadStatus, '文件解析失败：' + error.message, false);
        }
    };
    
    reader.onerror = function() {
        showMessage(uploadStatus, '文件读取失败', false);
    };
    
    reader.readAsArrayBuffer(file);
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
        const response = await fetchWithRateLimit(
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
